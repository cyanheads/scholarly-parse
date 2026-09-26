# Near-Optimal List-Recovery of Linear Code Families

Ray Li, Nikhil Shagrithaya  
2025  
arXiv: 2502.13877v2

## Abstract

We prove several results on linear codes achieving list-recovery capacity. We show that random linear codes achieve list-recovery capacity with constant output list size (independent of the alphabet size and length). That is, over alphabets of size at least $\ell^{\Omega(1/\varepsilon)}$, random linear codes of rate $R$ are $(1-R-\varepsilon,\ell,(\ell/\varepsilon)^{O(\ell/\varepsilon)})$-list-recoverable for all $R\in(0,1)$ and $\ell$. Together with a result of Levi, Mosheiff, and Shagrithaya, this implies that randomly punctured Reed–Solomon codes also achieve list-recovery capacity. We also prove that our output list size is near-optimal among *all* linear codes: all $(1-R-\varepsilon,\ell,L)$-list-recoverable linear codes must have $L\geq\ell^{\Omega(R/\varepsilon)}$.

Our simple upper bound combines the Zyablov-Pinsker argument with recent bounds from Kopparty, Ron-Zewi, Saraf, Wootters, and Tamo on the maximum intersection of a “list-recovery ball” and a low-dimensional subspace with large distance. Our lower bound is inspired by a recent lower bound of Chen and Zhang.

## 1 Introduction

In this work, we study list-recovery for random linear codes and random Reed–Solomon codes, proving near-optimal upper and lower bounds.

An *(error correcting) code* $\mathcal{C}$ is a subset of $\Sigma^{n}$ for an alphabet $\Sigma$, which, in this work, is always $\mathbb{F}_{q}$ for some prime power $q$. We study *linear* codes, which are subspaces of $\mathbb{F}_{q}^{n}$. We want codes to be large, meaning they have large *rate* $R=\left(\log_{q}|\mathcal{C}|\right)/n$. We also want codes to tolerate more errors. In the standard unique decoding setting, tolerating many errors means that, for any vector $z\in\mathbb{F}_{q}^{n}$, there is at most one *codeword* $c\in\mathcal{C}$ that agrees with $z$ on many coordinates.

We study a generalization of the unique-decoding problem known as list-recovery. In list-recovery, we want that, for any $\ell\times\ell\times\cdots\times\ell$ combinatorial rectangle, there are few codewords $c$ that “agree” with this rectangle on many coordinates. Formally, a code $\mathcal{C}$ is $\left(\rho,\ell,L\right)$*-list-recoverable* if for any sets $S_{1},\dots,S_{n}\subset\mathbb{F}_{q}$ of size $|S_{i}|=\ell$, there are at most $L$ codewords $c_{1},\ldots,c_{L}\in\mathcal{C}$ such that $c_{i}\in S_{i}$ for at least a $(1-\rho)n$ fraction of the coordinates. The special case of $(\rho,1,1)$ list-recoverability is the standard unique-decoding setting, and the special case of $(\rho,1,L)$ list-recovery is known as *list-decoding*.

List-recovery has motivations in coding theory, complexity theory, and algorithms. In coding theory, list-recovery has been used as a tool to obtain efficient list-decoding algorithms [GS99, GR08, GW13, Kop15, HRW19]. Also, list-recoverable random-linear codes — which we study in this work — are used as a building block in other coding constructions [GI01, HW18]. In complexity theory, list-recoverable codes find applications in constructions of other pseudorandom objects such as extractors [TZ04] and condensers [GUV09]. In algorithms, they are also useful primitives in group testing [INR10, NPR11] sparse recovery [GNPRS13], and streaming algorithms [LNNT19, DW20].

The list-recovery capacity theorem states that $\rho=1-R$ is the optimal tradeoff between the error radius $\rho$ and the code rate $R$. (see e.g., [GRS19, Res20]). That is, below capacity $\rho<1-R$, there exist $(p,\ell,O_{\ell}(1))$-list-recoverable codes of rate $R$, and above capacity $\rho>1-R$, any $(\rho,\ell,L)$-list-recoverable code must have exponential list size $L\geq q^{\Omega(n)}$. The existence holds because uniformly random codes of rate $R$ (over sufficiently large alphabets $q\geq\ell^{\Omega(1/\varepsilon)}$) are $(1-R-\varepsilon,\ell,O(\ell/\varepsilon))$-list-recoverable with high probability.

We wish to understand what kinds of codes achieve list-recovery capacity. A number of explicit code constructions are known to achieve list-recovery capacity, including Folded Reed–Solomon codes, Multiplicity codes, Folded Algebraic–Geometry codes. Additional techniques — subspace evasive sets, subspace designs, and expander techniques — can be used to improve the output list-size $L$ and alphabet size $q$ [GR08, Kop15, GW13, GX12, GX13, HW18, HRW19, GK16, DL12, KRSW18, Tam23] (see Table 1 in [KRSW18], see also [Sri24, CZ24] for even tighter list size bounds in the special case of list-decoding).

Still, several fundamental questions remain open.

1. First, how list-recoverable is a random linear code? A random linear code is a random subspace of $\mathbb{F}_{q}^{n}$. All explicit constructions are based on linear codes (though many are only linear over a subfield), so it is natural to wonder about list-recovery of a “typical” linear code. As list-recovery is a pseudorandom property, this question also addresses the deeper geometric question of “how similar is a random subspace to a random set over $\mathbb{F}_{q}^{n}$?”, which is well-studied in the more specific context of list-decoding [ZP81, Eli91, GHK11, CGV13, Woo13, RW14, RW15, RW18, LW20, GLMRSW21, AGL24].
2. Second, how list-recoverable are Reed–Solomon codes? The above constructions all generalize the Reed–Solomon code, the most fundamental polynomial evaluation code. Can Reed–Solomon codes themselves achieve list-recovery capacity? Given recent progress that showed the special case that Reed–Solomon codes achieve list-*decoding* capacity [BGM23, GZ23, AGL24], this general case of list-recovery has been an obvious and tantalizing open question.
3. Lastly, is there a fundamental separation between linear and nonlinear codes for list-recovery? On one hand, there is no apparent separation for the special case of list-decoding, where random linear codes are list-decodable to capacity with list-size $O(1/\varepsilon)$ [GHK11, Woo13, LW20, GLMRSW21], just like uniformly random codes. On the other hand, uniformly random codes are list-recoverable with list size $O(\ell/\varepsilon)$, but all known linear constructions require output list size at least $\ell^{\Omega(1/\varepsilon)}$, and this lower bound has been proven in various specific settings [GLMRSW21, LMS24, CZ24].

We answer all three questions. We show that random linear codes are list-recoverable to capacity with provably near-optimal output list size. By a recent result of [LMS24], this implies that randomly punctured Reed–Solomon codes are list-recoverable to capacity with near-optimal output list size. Lastly, we prove a fundamental separation between linear and non-linear codes by showing that *all* linear codes of rate $R$ must have list-size at least $L\geq\ell^{\Omega(R/\varepsilon)}$.

### 1.1 Our results

We now state our results in the context of prior work.

**Table 1.** List-recovery of Random Linear codes

| Citation | Radius $\rho$ | input list size | output list size |
| --- | --- | --- | --- |
| [ZP81, Gur04] | $1-R-\varepsilon$ | $\ell$ | $q^{O(\ell/\varepsilon)}$ |
| [RW18] | $1-R-\varepsilon$ | $\ell$ | $q^{O(\log^{2}(\ell/\varepsilon))}$ |
| This work | $1-R-\varepsilon$ | $\ell$ | $\ell^{O(\ell/\varepsilon)}$ |

#### 1.1.0.0.1 List recovery for Random Linear Codes.

Several known arguments show that random linear codes achieve list-recovery capacity. A random linear code is a code generated by a uniformly random generator matrix $\mathbf{G}\in\mathbb{F}_{q}^{n\times k}$. First, the Zyablov-Pinsker argument [ZP81] adapted to list-recovery shows that random linear codes of rate $R$ over alphabet $q\geq\ell^{\Omega(1/\varepsilon)}$ are $(1-R-\varepsilon,\ell,q^{O(\ell/\varepsilon)})$-list-recoverable (see, for example [Gur04, Lemma 9.6]). Rudra and Wootters [RW18] improved the output list size to $q^{O(\log^{2}(\ell/\varepsilon))}$, showing random linear codes of rate $R$ over alphabet $q\geq\ell^{\Omega(1/\varepsilon)}$ are $(1-R-\varepsilon,\ell,q^{O(\log^{2}(\ell/\varepsilon))})$-list-recoverable. We improve the output list size to be independent of the alphabet size $q$.

> **Theorem 1.1 (Theorem 3.1, Informal)**
>
> *For all $R,\varepsilon\in(0,1)$, and $q\geq\ell^{\Omega(1/\varepsilon)}$ a random linear code of rate $R$ is $\left(1-R-\varepsilon,\ell,\left(\frac{\ell}{\varepsilon}\right)^{O(\ell/\varepsilon)}\right)$-list-recoverable with high probability.*

Our list size improves on the prior bounds when $q\geq\ell^{\Omega(\ell/\varepsilon)}$, which covers most alphabet sizes ($q\geq\ell^{\Omega(1/\varepsilon)}$ is needed to achieve list-recovery capacity), and the improvement is more significant when $q$ is larger. This improvement to an alphabet-independent output list size is critical for Theorem 1.2 below (see Remark 1.3). As we show in Theorem 1.5, this output list size is near optimal among all linear codes.

Our proof is simple, combining the Zyablov–Pinsker [ZP81] argument with recent analyses of the list-recovery of explicit constructions like Folded Reed–Solomon codes. In particular, the Zyablov–Pinsker argument [ZP81] shows that a random linear code can be list-recovered so that, with high probability the output list always lies in a subspace of dimension at most $O(\ell/\varepsilon)$. Naively, this implies an output list size bound of $q^{O(\ell/\varepsilon)}$. However, recent analyses of list-recovering explicit codes [KRSW18, Tam23] showed that subspaces of dimension $D$ with good distance — random linear codes are well known to have good distance with high probability — can have at most $(\ell/\varepsilon)^{O(D)}$ points inside an $\ell$-list-recovery ball, thus giving our improved output list size. We also show that we get the best possible output list size for our proof technique, in the sense that, for any linear code, there are output lists that span a subspace of dimension at least $\Omega(\ell/\varepsilon)$ (see Proposition 5.2).

#### 1.1.0.0.2 List recovery for Random Reed-Solomon Codes.

Reed–Solomon codes [RS60] are the most fundamental evaluation codes. A Reed–Solomon code is given by $n$ evaluation points $\alpha_{1},\alpha_{2},\ldots,\alpha_{n}$ in a finite field $\mathbb{F}_{q}$, and a degree $k<n$, and is defined as

$$
\text{RS}_{n,k}(\alpha_{1},\ldots,\alpha_{n}):=\left\{\left(f(\alpha_{1}),\ldots,f(\alpha_{n})\right)\mid f\in\mathbb{F}_{q}[x],\text{ }\deg f<k\right\}.
$$

List-decoding and list-recovery of Reed–Solomon codes are well-studied questions. The seminal Guruswami–Sudan [GS99] algorithm showed that Reed–Solomon codes are list-decodable and list-recoverable up to the *Johnson radius* $1-\sqrt{R\ell}$ [Joh62, GS01]. Since then, there has been much interest in determining whether Reed–Solomon codes are list-decodable and list-recoverable beyond the Johnson bound, and perhaps even up to capacity $\rho=1-R$ (the capacity is $1-R$ for both list-decoding and list-recovery). Initially, there was evidence against this possibility [GR06, CW07, BKR10], suggesting that Reed–Solomon codes could not be list-decoded or list-recovered much beyond the Johnson bound. Since then, an exciting line of work has shown, to contrary, that Reed–Solomon codes can beat the Johnson bound for list-decoding [RW14, ST20, FKS22, GST22, GLSTW22, BGM23, GZ23, AGL24], and, in fact, can be list-decoded up to capacity [BGM23, GZ23, AGL24]. All of these works studied *randomly punctured* Reed–Solomon codes, where $\alpha_{1},\dots,\alpha_{n}$ are chosen at random from a larger field $q$.

Despite the exciting progress for list-decoding, there has been comparatively little progress on list-recovery. Lund and Potukuchi [LP20] and Guo, Li, Shanggaun, Tamo, and Wootters [GLSTW22] proved that (randomly punctured) Reed–Solomon codes are list-recoverable beyond the Johnson bound in the low-rate regime: [LP20] shows $(\rho,\ell,L)$-list-recovery for $\rho\leq 1-1/\sqrt{2}$, $L=O(\ell)$ and rate $O\left(\frac{1}{\sqrt{\ell}\log q}\right)$, and [GLSTW22] shows $\left(\Omega\left(\frac{\varepsilon}{\sqrt{\ell}\log(1/\varepsilon)}\right),\ell,O(\ell/\varepsilon)\right)$-list-recovery for rate $1-\varepsilon$ Reed–Solomon codes. Both improve on the Johnson radius of $O\left(\frac{1}{\ell}\right)$ in the low rate setting.

In [LMS24], Levi, Mosheiff and Shagrithaya showed that random Reed–Solomon codes and random linear codes are *locally equivalent*, meaning that both random code families achieve identical rate thresholds for all “local properties,” which include (the complements of) list-decoding and list-recovery. Thus, our result for list-recovery of random linear codes transfers to random RS codes as well.

> **Theorem 1.2 (Theorem 4.1, Informal)**
>
> *For all $R,\varepsilon\in(0,1)$, a randomly punctured Reed–Solomon code of length $n$ over alphabet size $q=n\cdot(\ell/\varepsilon)^{(\ell/\varepsilon)^{O(\ell/\varepsilon)}}$, of rate $R$ is $\left(1-R-\varepsilon,\ell,\left(\frac{\ell}{\varepsilon}\right)^{O(\ell/\varepsilon)}\right)$-list-recoverable with high probability.*

> **Remark 1.3**
>
> We note that in order to use the equivalence result from [LMS24], it is crucial that the upper bound on the list size be independent of the alphabet size, as guaranteed by Theorem 1.1. Hence, previous results on list size cannot be used with the equivalence result.

> **Remark 1.4**
>
> A fruitful line of work [GR08, Kop15, GW13, DL12, KRSW18, Tam23] has culminated in output list sizes of $O\left(\frac{\ell}{\varepsilon}\right)^{O(\log(\ell)/\varepsilon)}$ for various explicit list-recoverable codes such as Folded Reed–Solomon codes and Multiplicity codes. This list size is better than our list size of $(\frac{\ell}{\varepsilon})^{O(\ell/\varepsilon)}$ by roughly a factor of $\ell/\log(\ell)$ in the exponent. However, our results are still interesting because, as described above, the list-recovery of random linear codes and Reed–Solomon codes are fundamental questions, and also because our results yield linear codes for list-recovery and use much smaller alphabet sizes.

#### 1.1.0.0.3 Lower bounds for list-recovery.

We now discuss impossibility results for list-recovery. An early impossibility result of Guruswami and Rudra in [GR06] showed that, in the setting of zero-error list-recovery ($\rho=0$), many full length Reed–Solomon codes of rate $R$ require $R\leq 1/\ell$ in order to have $\poly n$ output list size, so many full length Reed–Solomon codes cannot be list-recovered beyond the Johnson bound — note this does not contradict Theorem 1.2, as we consider randomly punctured, as opposed to full length ($n=q$) codes. More recently it was shown that achieving list-recovery capacity requires exponential list size $\ell^{\Omega(1/\varepsilon)}$ for particular codes: random linear codes in the high-rate zero-error ($\rho=0$) regime [GLMRSW21], random linear codes in general parameter settings [LMS24], and for Reed–Solomon codes, Folded Reed–Solomon codes, and Multiplicity codes in general parameter settings [CZ24].

Inspired by the lower bound in [CZ24], we show that *any* linear code list-recoverable to capacity must have output list size at least $\ell^{\Omega(R/\varepsilon)}$.

> **Theorem 1.5 (Theorem 5.1, Informal)**
>
> *Over any field, any linear code of rate $R$ that is $(1-R-\varepsilon,\ell,L)$ list-recoverable must satisfy $L\geq\ell^{\Omega(R/\varepsilon)}$.*

One takeaway from Theorem 1.5 is that our list sizes of $(\ell/\varepsilon)^{O(\ell/\varepsilon)}$ in Theorem 1.1 and Theorem 1.2 are near-optimal. Additionally, Doron and Wootters [DW20] asked whether there were explicit list-recoverable codes with, among other desired guarantees, output list size $L=O(\ell)$. Our result shows this is not possible with *any* linear code. Lastly, our lower bound shows separation between non-linear and linear codes for list-recovery, which is perhaps surprising given that no such separation exists for list-decoding.

We point out that, for list-decoding ($\ell=1$), our lower bound is trivial ($L\geq 1$), so it does not contradict the recent results that random linear codes, randomly punctured Reed–Solomon codes, and randomly punctured Algebraic-Geometry codes achieve list-decoding capacity with output list size $O(1/\varepsilon)$ [BGM23, GZ23, AGL24, BDG+23].

## 2 Preliminaries

For a prime power $q$, let $\mathbb{F}_{q}$ be the finite field of order $q$. Let $[n]$ denote the set $\left\{1,\ldots,n\right\}$. For a given vector space $V$, let $\mathcal{L}(V)$ denote the set of all subspaces of $V$. For a given set $S$, let $2^{S}$ denote the power set of $S$. For a vector $v$, let $v[i]$ denote its $i$th entry.

A code $\mathcal{C}\subseteq\mathbb{F}_{q}^{n}$ is said to be linear if it is a linear subspace, and said to have rate $R\in(0,1)$ if $R=dim(\mathcal{C})/n$. We say $\mathcal{C}$ has relative distance $\delta\in(0,1)$ if $\forall c\in\mathcal{C},wt(c)\geq\delta\cdot n$, where $wt(c)$ denotes the number of non-zero entries in the codeword $c$. A matrix $\mathbf{G}\in\mathbb{F}_{q}^{n\times Rn}$ containing linearly independent columns is said to be the *generator matrix* of $\mathcal{C}$ if every codeword $c\in\mathcal{C}$ can be constructed using some linear combinations of the columns in $\mathbf{G}$. $\mathcal{C}$ is said to *contain* a set of vectors $s_{1},\ldots s_{b}\in\mathbb{F}_{q}^{n}$ if $s_{i}\in\mathcal{C}$ for every $i\in[b]$.

For a vector $x\in\mathbb{F}_{q}^{n}$ and sets $S_{1},\ldots,S_{n}\subseteq\mathbb{F}_{q}$, the *agreement set* $\agr(x,S_{1},\ldots,S_{n})$ is defined as:

$$
\agr(x,S_{1},\ldots,S_{n})\coloneqq\left\{i\in[n]\mid x[i]\in S_{i}\right\}.
$$

A $\rho$*-radius $\ell$-list-recovery ball* $B(\rho,S_{1}\times\cdots\times S_{n})$ is given by input lists $S_{1},\dots,S_{n}\subseteq\mathbb{F}_{q}$ of size $\ell$, and is defined to be

$$
\displaystyle B(\rho,S_{1}\times\cdots\times S_{n})=\left\{x\in\mathbb{F}_{q}^{n}:\agr(x,S_{1}\times\dots\times S_{n})\geq(1-\rho)n\right\}. \tag{1}
$$

We can alternatively define $(\rho,\ell,L)$-list-recovery using the above definition: a code $\mathcal{C}\subseteq\mathbb{F}_{q}^{n}$ is $(\rho,\ell,L)$-list-recoverable if every $\rho$-radius $\ell$-list-recovery ball $B$ contains at most $L$ codewords.

For $0<R<1$, a *random linear code* (RLC) of rate $R$ is a linear code whose generator matrix $\mathbf{G}\in\mathbb{F}_{q}^{n\times Rn}$ is a matrix whose entries are chosen uniformly at random from $\mathbb{F}_{q}$, independently of one another. For $\alpha_{1},\ldots,\alpha_{n}\in\mathbb{F}_{q}$, we use $\mathsf{RS}\left(\alpha_{1},\ldots,\alpha_{n};Rn\right)$ to denote the Reed–Solomon (RS) code of rate $R$ obtained by evaluating polynomials of degree $<Rn$ on evaluation points $\alpha_{1},\ldots,\alpha_{n}\in\mathbb{F}_{q}$. We say this is a *random RS code* if the evaluation points have been chosen uniformly at random and independently of one another^1.

### 2.1 Local Coordinate-Wise Linear (LCL) Properties

We now introduce the machinery in [LMS24] that connects random linear codes to (randomly punctured) Reed–Solomon codes. A *code property* $\mathcal{P}_{n}$ for codes of block length $n$ in $\mathbb{F}_{q}^{n}$ is simply a family of codes in $\mathbb{F}_{q}^{n}$. We say that a code $\mathcal{C}_{n}\subseteq\mathbb{F}_{q}^{n}$ *satisfies* $\mathcal{P}_{n}$ if $\mathcal{C}_{n}\in\mathcal{P}_{n}$. Denoting $\mathcal{P}\coloneqq\left\{\mathcal{P}_{n}\right\}_{n\in\mathbb{N}}$, we say that an infinite family of codes $\mathcal{C}_{n}\coloneqq\left\{\mathcal{C}_{n}\right\}_{n\in\mathbb{N}}$ *satisfies* $\mathcal{P}$ if $\mathcal{C}_{n}\in\mathcal{P}_{n}$ for every $n\in\mathbb{N}$. In this paper, we focus on local, monotone-increasing code properties. A local code property, informally speaking, is defined by the inclusion of some bad set. A *monotone-increasing* code property is one for which the following is true: if $\mathcal{C}$ satisfies $\mathcal{P}$, then every $\mathcal{C}^{\prime}$ for which $\mathcal{C}^{\prime}\supseteq\mathcal{C}$ holds, also satisfies $\mathcal{P}$. An example of local, monotone-increasing code property is the complement of $(\rho,L)$-list-decodability, defined as the family of all codes that contain at least one set of $L+1$ distinct vectors, all lying within a Hamming ball of radius $\rho$.

For a locality parameter $b\in\mathbb{N}$, an ordered tuple of subspaces $\mathcal{V}=(\mathcal{V}_{1},\ldots,\mathcal{V}_{n})$, where $\mathcal{V}_{i}\in\mathbb{F}_{q}^{b}$ for each $i\in[n]$ is defined to be a $b$*-local profile*. Note that $\mathcal{V}\in\mathcal{L}(\mathbb{F}_{q}^{b})^{n}$. We say that a matrix $A\in\mathbb{F}_{q}^{n\times b}$ *is contained in* $\mathcal{V}$ if the $i$th row of A belongs to $\mathcal{V}_{i}$, for all $i$. A code $\mathcal{C}\subseteq\mathbb{F}_{q}^{n}$ is said to *contain* $\mathcal{V}$ if there exists a matrix $A\in\mathbb{F}_{q}^{n\times b}$ *with distinct columns* such that the set of columns of $A$ is contained in $\mathcal{C}$, and moreover, $A$ is contained in $\mathcal{V}$. For a family of $b$-local profiles $\left\{\mathcal{F}_{n}\right\}_{n\in\mathbb{N}}$, where $\mathcal{F}_{n}\subseteq\mathcal{L}\left(\mathbb{F}_{q}^{b}\right)^{n}$, we define a $b$*-local coordinate wise linear* ($b$-LCL) property $\mathcal{P}\coloneqq\left\{\mathcal{P}_{n}\right\}_{n\in\mathbb{N}}$ as follows:

$$
\mathcal{P}_{n}=\left\{\mathcal{C}\in\mathbb{F}_{q}^{n}\mid\exists\mathcal{V}\in\mathcal{F}_{n}\textrm{ such that }\mathcal{C}\textrm{ contains }\mathcal{V}\right\}.
$$

The complement of $(\rho,\ell,L)$-list-recoverability is a $(L+1)$-LCL property. This is proven in [LMS24, Proposition 2.2], but we provide a justification in this paragraph. Every bad set of vectors lying within a given $\rho$-radius $\ell$-list-recovery ball agrees with some input lists $S_{1},\ldots,S_{n}\subseteq\mathbb{F}_{q}$ at a lot of coordinates. This implies that the vectors agree with one another at a lot of coordinates as well, and once we arrange the bad vector sets as rows in a matrix of dimension $n\times(L+1)$, we can specify these agreements as linear constraints on the rows of such matrices. Formally, the property is defined by a family of $(L+1)$-local profiles that we now describe. For every $n\in\mathbb{N}$, we define $\mathcal{F}_{n}$ by describing the $(L+1)$-local profiles $\mathcal{V}\in\mathcal{L}(\mathbb{F}_{q}^{L+1})^{n}$ that constitute it. Let $S_{(1-\rho)}\subseteq\left(2^{[n]}\right)^{L+1}$ denote the collection of all $L+1$-length tuples where each element is a subset of $[n]$ of size exactly $(1-\rho)n$. Furthermore, let $M_{[\ell]}\coloneqq[\ell]^{n\times(L+1)}$ denote the set of all matrices of dimension $n\times(L+1)$ having elements in $[\ell]$ ^2. Then, for every $s=(s_{1},\ldots,s_{(L+1)})\in S_{(1-\rho)}$, every $M\in M_{[\ell]}$, define $\mathcal{V}(s,M)=(\mathcal{V}_{1},\ldots,\mathcal{V}_{n})$ such that for every $i\in[n]$,

$$
\mathcal{V}_{i}\coloneqq\left\{r\in\mathbb{F}_{q}^{L+1}\mid\forall j,k\in[L+1],r[j]=r[k]\textrm{ if }(i\in s_{j})\land(i\in s_{k})\land(M[i,j]=M[i,k])\right\}.
$$

Note that each $\mathcal{V}_{i}$ is a subspace of $\mathbb{F}_{q}^{(L+1)}$, and therefore $\mathcal{V}(s,M)$ is a valid linear profile. We can now define the associated family of linear profiles for the complement of $(\rho,\ell,L)$-list-recoverability:

$$
\mathcal{F}_{n}\coloneqq\left\{\mathcal{V}\in\mathcal{L}\left(\mathbb{F}_{q}^{L+1}\right)^{n}\mid\exists s\in S_{(1-\rho)},M\in M_{[\ell]},~\textrm{ such that }\mathcal{V}=\mathcal{V}(s,M)\right\}.
$$

Observe that

$$
\left|\mathcal{F}_{\mathcal{P}}\right|\leq\left|S_{(1-\rho)}\right|\cdot\left|M_{[\ell]}\right|\leq\binom{n}{\rho n}^{(L+1)}\cdot\ell^{(L+1)n}. \tag{2}
$$

In the same work, the authors also prove a threshold theorem for random linear codes (RLCs) in relation to all LCL properties, and moreover, gave a complete characterization of the rate threshold. Informally, the theorem says that RLCs of a sufficiently large alphabet exhibit a sharp threshold phenomenon for all LCL properties, that is, for every LCL property $\mathcal{P}$, there exists a rate threshold $R_{\mathcal{P}}$ such that RLCs of rate $R_{\mathcal{P}}-\varepsilon$ satisfy $\mathcal{P}$ with high probability, and RLCs of rate $R_{\mathcal{P}}+\varepsilon$ **do not** satisfy $\mathcal{P}$ with high probability.

> **Theorem 2.1 ([LMS24], Theorem 3.1)**
>
> *Let $\mathcal{P}$ be a $b$-LCL property of codes in $\mathbb{F}_{q}^{n}$ and let $\mathcal{F}\subseteq\mathcal{L}\left(\mathbb{F}_{q}^{b}\right)^{n}$ be a corresponding family of profiles. Let $\mathcal{C}\subseteq\mathbb{F}_{q}^{n}$ be an RLC of rate R. Then, there is some threshold rate $R_{\mathcal{P}}$ for which the following holds.*
>
> 1. *If* $R\geq R_{\mathcal{P}}+\varepsilon$ *then* $\mathop{\bf Pr\/}[\mathcal{C}\textrm{ satisfies }\mathcal{P}]\geq 1-q^{-\varepsilon n+b^{2}}$*.*
> 2. *If* $R\leq R_{\mathcal{P}}-\varepsilon$ *then* $\mathop{\bf Pr\/}[\mathcal{C}\textrm{ satisfies }\mathcal{P}]\leq\left|\mathcal{F}\right|\cdot q^{-\varepsilon n+b^{2}}$*.*
> 3. *In particular, if* $R\leq R_{\mathcal{P}}-\varepsilon$ *and* $q\geq 2^{\frac{2\log_{2}|\mathcal{F}|}{\varepsilon n}}$ *then* $\mathop{\bf Pr\/}[\mathcal{C}\textrm{ satisfies }\mathcal{P}]\leq q^{-\frac{\varepsilon n}{2}+b^{2}}$*.*

The concept of LCL properties allows for “transfer type” theorems between random linear codes and random RS codes. In more detail, for every reasonable LCL property (that is, for every LCL property whose corresponding family of profiles is large), the rate thresholds for random linear codes and random RS codes are the same. That is, any rate threshold proved for LCL properties of RLCs also applies for random RS codes, and vice versa. For our purposes, we only require one part of this result, which we formally state below.

> **Theorem 2.2 ([LMS24], Theorem 3.10 (part 1) (Threshold theorem for RS codes))**
>
> *Let $\mathcal{P}$ be a $b$-LCL property of codes in $\mathbb{F}_{q}^{n}$, with associated local profile family $\mathcal{F}_{\mathcal{P}}\subseteq\mathcal{L}\left(\mathbb{F}_{q}^{b}\right)^{n}$ and (random linear code) threshold rate $R_{\mathcal{P}}$. Let $0<R^{\prime}<1$ and let $\mathcal{C}=\mathsf{RS}_{\mathbb{F}_{q}}\left(\alpha_{1},\dots,\alpha_{n};R^{\prime}n\right)$, and $\alpha_{1},\dots,\alpha_{n}$ are sampled independently and uniformly from $\mathbb{F}_{q}$. Assume that $q>R^{\prime}nb$. Fix $\varepsilon^{\prime}n\geq 2b(b+1)$. If $R^{\prime}\leq R_{\mathcal{P}}-\varepsilon^{\prime}$, then*
>
> $$
> \mathop{\bf Pr\/}[\mathcal{C}\textrm{ satisfies }\mathcal{P}]\leq(2^{b}-1)\cdot\left(\frac{(4b)^{4b}R^{\prime}n}{\varepsilon^{\prime}q}\right)^{\frac{\varepsilon^{\prime}n}{2b}}\cdot|\mathcal{F}_{\mathcal{P}}|. \tag{3}
> $$

## 3 List-recovery of Random Linear Codes

In this section, we prove Theorem 1.1, that random linear codes achieve list-recovery capacity with constant output list size. Formally, we show the following.

> **Theorem 3.1**
>
> *Fix $0<R<1$, $\varepsilon>0$ so that $(1-R-\varepsilon)>0$, $\ell\in\mathbb{N}$, and let $q$ be a prime power such that $q\geq\max\left(\ell^{\frac{8R}{\varepsilon}+6},\ell\cdot 2^{4/\varepsilon}\right)$. Let $\mathcal{C}\subseteq\mathbb{F}_{q}^{n}$ be an RLC of rate $R$. Then with probability at least $1-2q^{-\frac{\varepsilon n}{8}}$, $\mathcal{C}$ is $\left((1-R-\varepsilon),\ell,L\right)$-list-recoverable with $L$ satisfying $L\leq\left(\frac{2\ell}{\varepsilon}\right)^{2\ell/\varepsilon}$.*

The theorem follows as a consequence of two lemmas. We first state both lemmas, and then give the proof of Theorem 3.1 using them. The first lemma essentially states that any low dimensional subspace with good distance has few points in a list-recovery ball. This lemma appears in [KRSW18, Tam23]; we state the version from [Tam23, Lemma 3.1].

> **Lemma 3.2 ([Tam23], see also [KRSW18])**
>
> *For $\varepsilon>0$ and $\ell\in\mathbb{N}$, let $\mathcal{C}\subseteq\mathbb{F}_{q}^{n}$ be a linear code with relative distance $\delta>\varepsilon/2$ that is $(\delta-\frac{\varepsilon}{2},\ell,L)$-list-recoverable. Assume further that any output list is contained in a subspace $V\subseteq\mathcal{C}$ of dimension $r$. Then the output list size $L\leq\left(\frac{2\ell}{\varepsilon}\right)^{r}$.*

The second lemma uses the Zyablov–Pinsker argument [ZP81], showing that a random linear code does not have too many linearly independent codewords within a list-recovery ball.

> **Lemma 3.3**
>
> *Fix $0<R<1$, $\varepsilon>0$ so that $(1-R-\varepsilon)>0$, $\ell\in\mathbb{N}$, and let $q$ be a prime power such that $q\geq\max\left(\ell^{\frac{8R}{\varepsilon}+6},\ell\cdot 2^{4/\varepsilon}\right)$. Let $\mathcal{C}\subseteq\mathbb{F}_{q}^{n}$ be an RLC of rate $R$. Then with probability at least $1-q^{-\frac{\varepsilon nL}{8}}$, for every input lists $\mathcal{S}_{1},\ldots,\mathcal{S}_{n}$ of size $\ell$, the maximal linearly independent subset of $\mathcal{C}$ within the $(1-R-\varepsilon)$ radius $\ell$-list-recovery ball $B\left((1-R-\varepsilon),S_{1}\times\cdots\times S_{n}\right)$ has size less than $2\ell/\varepsilon$.*

> **Proof of Lemma 3.3**
>
> Denote $\rho:=1-R-\varepsilon$ and $L:=2\ell/\varepsilon$. We also assume $q$ is a multiple of $\ell$ for simplicity of exposition, and note that the result holds in the general case as well. We show that an RLC “avoids” all bad configurations with high probability. A *bad configuration* is a set $V$ of linearly independent vectors of size $L$ such that there exist input lists lists $\mathcal{S}_{1},\ldots,\mathcal{S}_{n}$ of size $\ell$, so that $V\subseteq B\left(\rho,S_{1}\times\cdots\times S_{n}\right)$. We say that $\mathcal{C}$ contains a bad configuration $V$ if for every $v\in V$, $v$ is also in $\mathcal{C}$. If this condition is not satisfied, then we say that $\mathcal{C}$ does not contain $V$. It is easy to see that if $\mathcal{C}$ contains no bad configurations, then the maximal linearly independent subset of $\mathcal{C}$ within any $\ell$-list-recovery ball of radius $\rho$ has size less than $2\ell/\varepsilon$. Therefore we show that the probability of $\mathcal{C}$ containing a bad configuration is low.
>
> Fix input lists $\mathcal{S}_{1},\ldots,\mathcal{S}_{n}$ of size $\ell$, and let $B:=B\left(\rho,S_{1}\times\cdots\times S_{n}\right)$ be the corresponding $\rho$ radius $\ell$-list-recovery ball. The size of $B$ is $\binom{n}{\rho n}\cdot\ell^{(1-\rho)n}\cdot(q-\ell)^{\rho n}$. The probability that a particular configuration is bad is equal to the probability of the encodings of some $L$ linearly independent messages being inside $B$ simultaneously, which is $\left(\frac{|B|}{q^{n}}\right)^{L}$. By a union bound over at most $q^{n\ell}$ possible input lists and all $L$-sized linearly independent subsets of the message vectors in $\mathbb{F}_{q}^{Rn}$ (there are at most $q^{RnL}$ such subsets), we have
>
> $$
> \displaystyle\mathop{\bf Pr\/}_{\mathcal{C}}[\mathcal{C}\text{ contains a bad configuration}] \displaystyle\leq\left(\frac{\binom{n}{\rho n}\cdot\ell^{(1-\rho)n}\cdot(q-\ell)^{\rho n}}{q^{n}}\right)^{L}\cdot q^{n\ell}\cdot q^{RnL}
> $$
>
> $$
> \displaystyle=\left(\left(\frac{\ell}{q}\right)^{n}\cdot\binom{n}{\rho n}\cdot\left(\frac{q}{\ell}-1\right)^{\rho n}\right)^{L}\cdot q^{n\ell}\cdot q^{RnL}
> $$
>
> $$
> \displaystyle\leq\left(\left(\frac{\ell}{q}\right)^{n}\cdot(q/\ell)^{H_{q/\ell}(\rho)n}\right)^{L}\cdot q^{n\ell}\cdot q^{RnL}
> $$
>
> $$
> \displaystyle\leq\left((q/\ell)^{-(1-H_{q/\ell}(\rho))n}\right)^{L}\cdot q^{n\ell}\cdot q^{RnL}
> $$
>
> $$
> \displaystyle\leq\left((q/\ell)^{-\left(R+\frac{3\varepsilon}{4}\right)n}\right)^{L}\cdot q^{n\ell}\cdot q^{RnL} \tag{4}
> $$
>
> $$
> \displaystyle=\ell^{(R+\frac{3\varepsilon}{4})nL}\cdot q^{-\left(R+\frac{3\varepsilon}{4}\right)nL}\cdot q^{\frac{\varepsilon nL}{2}}\cdot q^{RnL}
> $$
>
> $$
> \displaystyle=\ell^{(R+\frac{3\varepsilon}{4})nL}\cdot q^{-\frac{\varepsilon nL}{4}}
> $$
>
> $$
> \displaystyle\leq q^{-\frac{\varepsilon nL}{8}}.
> $$
>
> In Equation 4, we used $q\geq\ell\cdot 2^{4/\varepsilon}$, and for the last inequality, we used $q\geq\ell^{\frac{8R}{\varepsilon}+6}$. This implies that the probability with which $\mathcal{C}$ does not contain any bad configuration is at least $1-q^{-\frac{\varepsilon nL}{8}}$. ∎

We now prove Theorem 3.1.

> **Proof of Theorem 3.1**
>
> Denote $\rho:=1-R-\varepsilon$. Denote by $E_{1}$ the event that for a RLC $\mathcal{C}$ of rate $R$, the maximal linearly independent subset of $\mathcal{C}$ within every $(1-R-\varepsilon)$ radius $\ell$-list-recovery ball has size less than $2\ell/\varepsilon$. By Lemma 3.3, we know that $E_{1}$ happens with probability at least $1-q^{-\frac{\varepsilon nL}{8}}$. Let $E_{2}$ denote the event that a rate $R$ RLC $\mathcal{C}$ has distance at least $1-R-\frac{\varepsilon}{2}$. By the Gilbert-Varshamov bound (see [GRS22], Section 4.2), and because of the fact that $q\geq\ell\cdot 2^{4/\varepsilon}\geq 2^{4/\varepsilon}$, $E_{2}$ happens with probability at least $1-q^{-\frac{\varepsilon n}{2}}$. Therefore we have
>
> $$
> \mathop{\bf Pr\/}_{\mathcal{C}}[E_{1}\land E_{2}]\geq 1-q^{-\frac{\varepsilon nL}{8}}-q^{-\frac{\varepsilon n}{2}}\geq 1-2\cdot q^{-\frac{\varepsilon n}{8}}
> $$
>
> When $E_{1}$ and $E_{2}$ occur simultaneously, the assumptions of Lemma 3.2 are satisfied by $\mathcal{C}$ with $r=2\ell/\varepsilon$ and $\delta=1-R-\frac{\varepsilon}{2}$, and therefore we see that
>
> $$
> \mathop{\bf Pr\/}_{\mathcal{C}}\left[\bigwedge_{B}\left|\mathcal{C}\cap B\right|\leq\left(\frac{2\ell}{\varepsilon}\right)^{2\ell/\varepsilon}\right]\geq 1-2\cdot q^{-\frac{\varepsilon n}{8}}
> $$
>
> where $B$ is ranging over all $(1-R-\varepsilon)$ radius $\ell$-list-recovery balls, and we are done. ∎

## 4 List-Recovery of Reed–Solomon codes

In this section, we will prove the following result, which says that random Reed–Solomon codes are list-recoverable to capacity with constant output list size. The proof combines Theorem 3.1 from the previous section with Theorem 2.1, the equivalence theorem from [LMS24].

> **Corollary 4.1**
>
> *Fix $0<R<1$, $\varepsilon>0$ so that $(1-R-\varepsilon)>0$, $\ell\in\mathbb{N}$. Fix a constant $\varepsilon^{\prime}>0$ such that $\varepsilon^{\prime}<R$, and denote $L\coloneqq\lfloor{\left(\frac{2\ell}{\varepsilon}\right)^{2\ell/\varepsilon}}\rfloor$. Let $\eta>0$ be a constant, and let $q$ be a prime power satisfying $q>\frac{(4(L+1))^{4(L+1)}Rn}{\varepsilon^{\prime}}\cdot 2^{\frac{((\log\ell+2)(L+1)+\eta)\cdot 2(L+1)}{\varepsilon^{\prime}}}$. Then, a random RS code of rate $R-\varepsilon^{\prime}$ over $\mathbb{F}_{q}^{n}$ is $(1-R-\varepsilon,\ell,L)$-list-recoverable with probability at least $1-2^{-\eta n}$.*

> **Proof of Corollary 4.1**
>
> Denote $L\coloneqq\lfloor{\left(\frac{2\ell}{\varepsilon}\right)^{2\ell/\varepsilon}}\rfloor$ and $b\coloneqq L+1$. Let $\mathcal{P}$ be the $b$-LCL property of **not** being $(1-R-\varepsilon,\ell,L)$-list-recoverable, and let $R_{\mathcal{P}}$ be the corresponding (random linear code) threshold rate. By Theorem 2.1, part 1 [LMS24], we know that if $\mathcal{C}$ is an RLC of rate $R$, then the following holds for every constant $\varepsilon^{*}>0$:
>
> $$
> \mathop{\bf Pr\/}[\mathcal{C}\textrm{ satisfies }\mathcal{P}]<1-q^{\varepsilon^{*}n+b^{2}}\implies R<R_{\mathcal{P}}+\varepsilon^{*}
> $$
>
> According to Theorem 3.1, a rate $R$ RLC (having a sufficiently large alphabet size) satisfies $\mathcal{P}$ only with probability at most $2q^{-\frac{\varepsilon n}{8}}<1-q^{\varepsilon^{*}n+b^{2}}$. Therefore, $R<R_{\mathcal{P}}+\varepsilon^{*}$ for every $\varepsilon^{*}>0$, and so $R\leq R_{\mathcal{P}}$.
>
> We will now work with random RS codes having rate slightly less than $R$. Define $R^{\prime}\coloneqq R-\varepsilon^{\prime}\leq R_{\mathcal{P}}-\varepsilon^{\prime}$, take $n$ to be large enough so that $\varepsilon^{\prime}n\geq 2b(b+1)$. Note that $q>Rnb>R^{\prime}nb$. Define $\mathcal{C}=\mathsf{RS}_{\mathbb{F}_{q}}\left(\alpha_{1},\dots,\alpha_{n};R^{\prime}n\right)$, where $\alpha_{1},\dots,\alpha_{n}$ are sampled independently and uniformly from $\mathbb{F}_{q}$. Upon denoting $\mathcal{F}_{\mathcal{P}}$ to be the local profile family associated with property $\mathcal{P}$, we see that the hypothesis of Theorem 2.2 [LMS24] is satisfied, and therefore, Equation 3 is satisfied.
>
> Recall that we calculated an upper bound for $\left|\mathcal{F}_{\mathcal{P}}\right|$ in Equation 2, and so $\left|\mathcal{F}_{\mathcal{P}}\right|\leq\binom{n}{(1-R-\varepsilon)n}^{b}\cdot\ell^{bn}$. Substituting this bound on $\left|\mathcal{F}_{\mathcal{P}}\right|$ in Equation 3,
>
> $$
> \displaystyle\mathop{\bf Pr\/}[\mathcal{C}\textrm{ satisfies }\mathcal{P}] \displaystyle\leq(2^{b}-1)\cdot\left(\frac{(4b)^{4b}R^{\prime}n}{\varepsilon^{\prime}q}\right)^{\frac{\varepsilon^{\prime}n}{2b}}\cdot|\mathcal{F}_{\mathcal{P}}|
> $$
>
> $$
> \displaystyle\leq\left(\frac{(4b)^{4b}R^{\prime}n}{\varepsilon^{\prime}q}\right)^{\frac{\varepsilon^{\prime}n}{2b}}\cdot\binom{n}{(1-R-\varepsilon)n}^{b}\cdot\ell^{bn}
> $$
>
> $$
> \displaystyle\leq\left(\frac{(4(L+1))^{4(L+1)}R^{\prime}n}{\varepsilon^{\prime}q}\right)^{\frac{\varepsilon^{\prime}n}{2(L+1)}}\cdot 2^{(H_{2}(1-R-\varepsilon)+1)\cdot(L+1)n}.
> $$
>
> Because $q>\frac{(4(L+1))^{4(L+1)}R^{\prime}n}{\varepsilon^{\prime}}\cdot 2^{\frac{((\log\ell+2)(L+1)+\eta)\cdot 2(L+1)}{\varepsilon^{\prime}}}$, we see that $\mathop{\bf Pr\/}[\mathcal{C}\textrm{ satisfies }\mathcal{P}]\leq 2^{-\eta n}$. Thus, $\mathcal{C}$ is $(1-R-\varepsilon,\ell,L)$-list-recoverable with probability at least $1-2^{-\eta n}$. ∎

## 5 Any linear code needs output list-size $\ell^{\Omega(R/\epsilon)}$

We now prove our lower bounds for list-recovery, that any linear code list-recoverable to capacity needs output list size $\ell^{\Omega(R/\varepsilon)}$.

> **Theorem 5.1**
>
> *Let $R,\varepsilon\in(0,1)$, $\ell$ be a positive integer, and $n\geq n_{0}(\ell,R,\varepsilon)$ be sufficiently large. Let $\mathcal{C}\subseteq\mathbb{F}^{n}$ be a linear code of rate $R$. If $\mathcal{C}$ is $(1-R-\varepsilon,\ell,L)$-list-recoverable, then $L>\ell^{\lfloor{R/\varepsilon}\rfloor}$.*

> **Proof**
>
> Let $k\coloneqq Rn$ be the dimension of the code. Let $k^{\prime}=\left\lceil{\frac{\varepsilon}{R}\cdot k}\right\rceil$. Let $m=\left\lfloor{\frac{k-1}{k^{\prime}+1}}\right\rfloor$. By Gaussian elimination and permuting rows and columns, we may, without loss of generality write the generator matrix of $\mathcal{C}$ as
>
> $$
> \displaystyle\mathbf{G}=\begin{bmatrix}1&&&&\\
> &1&&&\\
> &&\ddots&&\\
> &&&\ddots&\\
> &&&&1\\
> \hline\cr*&*&\cdots&\cdots&*\\
> \end{bmatrix} \tag{5}
> $$
>
> where each $*$ is a length $n-k$ vector. For $i\in[k]$, let $v_{i}\in\mathbb{F}^{n}$ denote the columns. By rank-nullity, there exist vectors $w_{0},\dots,w_{m-1}\in\mathbb{F}^{n}$ such that $w_{i}$ is a linear combination of $v_{i\cdot(k^{\prime}+1)+1},\dots,v_{(i+1)\cdot(k^{\prime}+1)}$ such that $w_{i}$ is not supported on indices $k+1,\dots,k+k^{\prime}$ (there are $k^{\prime}+1$ vectors and $k^{\prime}$ indices). Now let $w_{m}=v_{k}$. Restricted to indices in $[k+k^{\prime}]$, vectors $w_{0},\dots,w_{m}$ have pairwise disjoint supports: within indices $[k+k^{\prime}]$, for $i=0,\dots,m-1$, vector $w_{i}$ is supported on $i\cdot(k^{\prime}+1)+1,\dots,(i+1)\cdot(k^{\prime}+1)\leq k-1$, and vector $w_{m}$ is supported on $k,\dots,k+k^{\prime}$.
>
> Now fix $\ell$ arbitrary distinct values $\beta_{1},\dots,\beta_{\ell}\in\mathbb{F}_{q}$. Consider the output list $\mathcal{L}=\{\sum_{i=0}^{m}\beta_{r_{i}}w_{i}:r_{i}\in[\ell]\}$ to be all linear combinations of $w_{i}$ with coefficients from $\beta_{1},\dots,\beta_{\ell}$. The fact that the vectors $w_{0},\dots,w_{m}$ have pairwise disjoint supports on $[k+k^{\prime}]$ implies (i) the vectors $w_{0},\dots,w_{m}$ are linearly independent, and so all vectors in $\mathcal{L}$ are distinct, and (ii) the vectors in $\mathcal{L}$ can only take on one of $\ell$ values at any index in $[k+k^{\prime}]$. Therefore, we can choose input lists $S_{1},\dots,S_{k+k^{\prime}}$, each of size $\ell$ such that all codewords in $\mathcal{L}$ agree with all of $S_{1},\dots,S_{k+k^{\prime}}$.
>
> Choosing the rest of the input lists arbitrarily, we have that this code is not $(\rho,\ell,L)$ list-recoverable with radius $\rho=(n-k-k^{\prime})/n<1-R-\varepsilon$ and list size $L=\ell^{m+1}\geq\ell^{\lfloor{R/\varepsilon}\rfloor}.$^3
>
> ∎

We also show that our Zyablov-Pinsker type argument in Theorem 1.1 (Lemma 3.3) is tight, in the sense that any linear code must have $\Omega(\ell/\varepsilon)$ linearly independent codewords in a list-recovery ball.

> **Proposition 5.2**
>
> *Let $R,\varepsilon\in(0,1)$, $\ell$ be a positive integer, and $n\geq n_{0}(\ell,R,\varepsilon)$ be sufficiently large. Let $\mathcal{C}$ be a linear code of rate $R$. Then there exists a $(1-R-\varepsilon)$ radius $\ell$-list-recovery ball $B$ that contains at least $\lceil{(1-R)\ell/\varepsilon}\rceil-1$ linearly independent elements of $\mathcal{C}$.*

> **Proof**
>
> Upon writing the generator matrix of $\mathcal{C}$ in the same form as described above in the proof of Theorem 5.1, consider the first $m\coloneqq\lceil{(1-R)\ell/\varepsilon}\rceil-1<(1-R)\ell/\varepsilon$ columns of the generator matrix. Denote these linearly independent column vectors by $v_{1},\ldots,v_{m}$. Create input lists $S_{1},\dots,S_{k}$ each of size $\ell$ that contain $0$ and $1$, but are otherwise arbitrary. Then create lists $S_{k+1},\dots,S_{n}$ of size $\ell$, each containing elements that are evenly distributed so that they agree equally with each of $v_{1},\dots,v_{m}$. Thus, each of $v_{1},\dots,v_{m}$ agrees with $S_{1},\dots,S_{n}$ on the first $k$, and on at least $\lfloor{\frac{\ell}{m}\cdot(n-k)}\rfloor>\varepsilon n$ of the remaining coordinates. Therefore, these vectors lie inside a $(1-R-\varepsilon)n$-radius $\ell$-list-recovery ball around $S_{1},\dots,S_{n}$, as desired. ∎

## 6 Concluding remarks

We showed that random linear codes and Reed–Solomon codes are list-recoverable to capacity with near-optimal output-list size. Several open questions remain.

1. What is the optimal output-list size for random linear codes and Reed–Solomon codes? There is a gap between our upper bound of $(\frac{\ell}{\varepsilon})^{O(\ell/\varepsilon)}$ and the lower bound of $\ell^{\Omega(1/\varepsilon)}$. We surmise that the correct answer is closer to the lower bound.
2. As asked by Doron and Wootters [DW20], are there *explicit* list-recoverable codes with output list size $L=O_{\varepsilon}(\ell)$? (and, even better, over alphabet size $q=\poly(\ell)$). We showed (Theorem 1.5) that any such code must be nonlinear.
3. Our alphabet size for list-recovering Reed–Solomon codes (Theorem 1.2) is optimal in that it is linear in $n$, but the constant is double-exponential in $\ell/\varepsilon$. By contrast, for list-decoding, the best known alphabet size for achieving capacity has an exponential-type constant, $2^{\poly(1/\varepsilon)}\cdot n$ [AGL24]. Can our alphabet size be improved?

## 7 Acknowledgments

The authors would like to thank Yeyuan Chen and Zihan Zhang for pointing out a mistake in Theorem 5.1 in an earlier version of the paper.

rangepages12 rangepages8 rangepages-1 rangepages15 rangepages27 rangepages1 rangepages8 rangepages8 rangepages6 rangepages12 rangepages6 rangepages12 rangepages8 rangepages10 rangepages25 rangepages8 rangepages16 rangepages11 rangepages-1 rangepages12 rangepages12 rangepages10 rangepages17 rangepages-1 rangepages17 rangepages17 rangepages5 rangepages34 rangepages12 rangepages6 rangepages15 rangepages-1 rangepages12 rangepages5 rangepages10 rangepages10 rangepages19 rangepages14 rangepages11 rangepages8 rangepages5

## Footnotes

- **1** This is different from the usual model for random RS codes, where it is required that the random evaluation points be distinct. However, it can be shown that both models behave similarly (refer to [LMS24], Appendix A for details).
- **2** Even though $S_{(1-\rho)}$ and $M_{[\ell]}$ depend on $n$, we have suppressed this dependence in the notation for sake of clarity.
- **3** $m+1=\left\lfloor{\frac{k+k^{\prime}}{k^{\prime}+1}}\right\rfloor\geq\left\lfloor{\frac{k+\frac{\varepsilon}{R}k}{\frac{\varepsilon}{R}k+2}}\right\rfloor\geq\left\lfloor{\frac{R}{\varepsilon}}\right\rfloor$, where we used that $k>2R^{2}/\varepsilon^{2}$.

## References

- [AGL24] Omar Alrabiah, Venkatesan Guruswami and Ray Li “Randomly Punctured Reed-Solomon Codes Achieve List-Decoding Capacity over Linear-Sized Fields” In *Proceedings of the 56th Annual ACM Symposium on Theory of Computing, STOC 2024, Vancouver, BC, Canada, June 24-28, 2024* ACM, 2024, pp. 1458–1469 DOI: [10.1145/3618260.3649634](https://dx.doi.org/10.1145/3618260.3649634)
- [BKR10] Eli Ben-Sasson, Swastik Kopparty and Jaikumar Radhakrishnan “Subspace Polynomials and Limits to List Decoding of Reed-Solomon Codes” In *IEEE Trans. Inform. Theory* **56.1**, 2010, pp. 113–120 DOI: [10.1109/TIT.2009.2034780](https://dx.doi.org/10.1109/TIT.2009.2034780)
- [BDG+23] Joshua Brakensiek, Manik Dhar and Sivakanth Gopi “AG codes achieve list decoding capacity over contant-sized fields” In *arXiv preprint arXiv:2310.12898*, 2023
- [BGM23] Joshua Brakensiek, Sivakanth Gopi and Visu Makam “Generic Reed-Solomon codes achieve list-decoding capacity” In *STOC 2023*, 2023, pp. to appear
- [CZ24] Yeyuan Chen and Zihan Zhang “Explicit Folded Reed-Solomon and Multiplicity Codes Achieve Relaxed Generalized Singleton Bounds” arXiv:2408.15925 arXiv, 2024 DOI: [10.48550/arXiv.2408.15925](https://dx.doi.org/10.48550/arXiv.2408.15925)
- [CW07] Qi Cheng and Daqing Wan “On the List and Bounded Distance Decodability of Reed-Solomon Codes” Place: Philadelphia, PA, USA Publisher: Society for Industrial and Applied Mathematics In *SIAM J. Comput.* **37.1**, 2007, pp. 195–209 DOI: [10.1137/S0097539705447335](https://dx.doi.org/10.1137/S0097539705447335)
- [CGV13] Mahdi Cheraghchi, Venkatesan Guruswami and Ameya Velingker “Restricted Isometry of Fourier Matrices and List Decodability of Random Linear Codes” In *SIAM J. Comput.* **42.5** SIAM, 2013, pp. 1888–1914
- [DW20] Dean Doron and Mary Wootters “High-Probability List-Recovery, and Applications to Heavy Hitters.” In *Electron. Colloquium Comput. Complex.* **27**, 2020, pp. 162
- [DL12] Zeev Dvir and Shachar Lovett “Subspace evasive sets” In *Proceedings of the forty-fourth annual ACM symposium on Theory of computing*, 2012, pp. 351–358
- [Eli91] Peter Elias “Error-correcting codes for list decoding” Publisher: IEEE In *IEEE Transactions on Information Theory* **37.1**, 1991, pp. 5–12
- [FKS22] Asaf Ferber, Matthew Kwan and Lisa Sauermann “List-decodability with large radius for Reed-Solomon codes” Publisher: IEEE In *IEEE Transactions on Information Theory* **68.6**, 2022, pp. 3823–3828
- [GNPRS13] Anna Gilbert et al. “l2/l2-foreach sparse recovery with low risk” In *International Colloquium on Automata, Languages, and Programming*, 2013, pp. 461–472 Springer
- [GST22] Eitan Goldberg, Chong Shangguan and Itzhak Tamo “Singleton-type bounds for list-decoding and list-recovery, and related results” In *2022 IEEE International Symposium on Information Theory (ISIT)* IEEE, 2022, pp. 2565–2570
- [GZ23] Zeyu Guo and Zihan Zhang “Randomly Punctured Reed-Solomon Codes Achieve the List Decoding Capacity over Polynomial-Size Alphabets” In *arXiv preprint arXiv:2304.01403*, 2023
- [GLSTW22] Zeyu Guo et al. “Improved list-decodability and list-recoverability of Reed-Solomon codes via tree packings” In *2021 IEEE 62nd Annual Symposium on Foundations of Computer Science (FOCS)* IEEE, 2022, pp. 708–719
- [Gur04] Venkatesan Guruswami “List Decoding of Error-Correcting Codes (Winning Thesis of the 2002 ACM Doctoral Dissertation Competition)” **3282**, Lecture Notes in Computer Science Springer, 2004 DOI: [10.1007/B104335](https://dx.doi.org/10.1007/B104335)
- [GHK11] Venkatesan Guruswami, Johan Håstad and Swastik Kopparty “On the List-Decodability of Random Linear Codes” In *IEEE Trans. Inform. Theory* **57.2**, 2011, pp. 718–725 DOI: [10.1109/TIT.2010.2095170](https://dx.doi.org/10.1109/TIT.2010.2095170)
- [GI01] Venkatesan Guruswami and Piotr Indyk “Expander-based constructions of efficiently decodable codes” In *Proceedings 42nd IEEE Symposium on Foundations of Computer Science* IEEE, 2001, pp. 658–667
- [GK16] Venkatesan Guruswami and Swastik Kopparty “Explicit subspace designs” Publisher: Springer In *Combinatorica* **36.2**, 2016, pp. 161–185
- [GR06] Venkatesan Guruswami and Atri Rudra “Limits to List Decoding Reed–Solomon Codes” Place: Piscataway, NJ, USA Publisher: IEEE Press In *IEEE Trans. Inform. Theory* **52.8**, 2006, pp. 3642–3649 DOI: [10.1109/TIT.2006.878164](https://dx.doi.org/10.1109/TIT.2006.878164)
- [GR08] Venkatesan Guruswami and Atri Rudra “Explicit codes achieving list decoding capacity: Error-correction with optimal redundancy” Publisher: IEEE In *IEEE Transactions on Information Theory* **54.1**, 2008, pp. 135–150
- [GRS19] Venkatesan Guruswami, Atri Rudra and Madhu Sudan “Essential coding theory” In *Draft available at http://cse.buffalo.edu/faculty/atri/courses/coding-theory/book/*, 2019
- [GRS22] Venkatesan Guruswami, Atri Rudra and Madhu Sudan “Essential coding theory” In *Draft available at https://cse.buffalo.edu/faculty/atri/courses/coding-theory/book/*, 2022
- [GS99] Venkatesan Guruswami and Madhu Sudan “Improved Decoding of Reed–Solomon and Algebraic-Geometry Codes” In *IEEE Transactions on Information Theory* **45.6**, 1999, pp. 1757–1767 DOI: [10.1109/18.782097](https://dx.doi.org/10.1109/18.782097)
- [GS01] Venkatesan Guruswami and Madhu Sudan “Extensions to the Johnson bound” In *Manuscript, February*, 2001
- [GUV09] Venkatesan Guruswami, Christopher Umans and Salil. Vadhan “Unbalanced expanders and randomness extractors from Parvaresh-Vardy codes” In *J. ACM* **56.4**, 2009, pp. 20:1–20:34 DOI: [10.1145/1538902.1538904](https://dx.doi.org/10.1145/1538902.1538904)
- [GW13] Venkatesan Guruswami and Carol Wang “Linear-algebraic list decoding for variants of Reed–Solomon codes” Publisher: IEEE In *IEEE Transactions on Information Theory* **59.6**, 2013, pp. 3257–3268
- [GX12] Venkatesan Guruswami and Chaoping Xing “Folded codes from function field towers and improved optimal rate list decoding” In *Proceedings of the forty-fourth annual ACM symposium on Theory of computing*, 2012, pp. 339–350
- [GX13] Venkatesan Guruswami and Chaoping Xing “List decoding Reed-Solomon, Algebraic-Geometric, and Gabidulin subcodes up to the Singleton bound” In *Proceedings of the forty-fifth annual ACM symposium on Theory of computing*, 2013, pp. 843–852
- [GLMRSW21] Venkatesan Guruswami et al. “Bounds for list-decoding and list-recovery of random linear codes” Publisher: IEEE In *IEEE Transactions on Information Theory* **68.2**, 2021, pp. 923–939
- [HRW19] Brett Hemenway, Noga Ron-Zewi and Mary Wootters “Local list recovery of high-rate tensor codes and applications” Publisher: SIAM In *SIAM Journal on Computing* **49.4**, 2019, pp. FOCS17–157
- [HW18] Brett Hemenway and Mary Wootters “Linear-time list recovery of high-rate expander codes” Publisher: Elsevier In *Information and Computation* **261**, 2018, pp. 202–218
- [INR10] Piotr Indyk, Hung Ngo and Atri Rudra “Efficiently decodable non-adaptive group testing” In *Proceedings of the twenty-first annual ACM-SIAM symposium on Discrete Algorithms*, 2010, pp. 1126–1142 SIAM
- [Joh62] Selmer Johnson “A new upper bound for error-correcting codes” Publisher: IEEE In *IRE Transactions on Information Theory* **8.3**, 1962, pp. 203–207
- [Kop15] Swastik Kopparty “List-decoding multiplicity codes” Publisher: Theory of Computing Exchange In *Theory of Computing* **11.1**, 2015, pp. 149–182
- [KRSW18] Swastik Kopparty, Noga Ron-Zewi, Shubhangi Saraf and Mary Wootters “Improved decoding of folded Reed-Solomon and multiplicity codes” In *2018 IEEE 59th Annual Symposium on Foundations of Computer Science (FOCS)* IEEE, 2018, pp. 212–223
- [LNNT19] Kasper Larsen, Jelani Nelson, Huy Nguyễn and Mikkel Thorup “Heavy hitters via cluster-preserving clustering” In *Communications of the ACM* **62.8** ACM New York, NY, USA, 2019, pp. 95–100
- [LMS24] Matan Levi, Jonathan Mosheiff and Nikhil Shagrithaya “Random Reed-Solomon Codes and Random Linear Codes are Locally Equivalent” arXiv:2406.02238 arXiv, 2024 DOI: [10.48550/arXiv.2406.02238](https://dx.doi.org/10.48550/arXiv.2406.02238)
- [LW20] Ray Li and Mary Wootters “Improved list-decodability of random linear binary codes” Publisher: IEEE In *IEEE Transactions on Information Theory* **67.3**, 2020, pp. 1522–1536
- [LP20] Ben Lund and Aditya Potukuchi “On the List Recoverability of Randomly Punctured Codes” In *Approximation, Randomization, and Combinatorial Optimization. Algorithms and Techniques (APPROX/RANDOM 2020)* **176**, 2020, pp. 30:1–30:11
- [NPR11] Hung Ngo, Ely Porat and Atri Rudra “Efficiently decodable error-correcting list disjunct matrices and applications” In *Automata, Languages and Programming: 38th International Colloquium, ICALP 2011, Zurich, Switzerland, July 4-8, 2011, Proceedings, Part I 38*, 2011, pp. 557–568 Springer
- [RS60] I.. Reed and G. Solomon “Polynomial Codes Over Certain Finite Fields” In *Journal of the Society for Industrial and Applied Mathematics* **8.2**, 1960, pp. 300–304 DOI: [10.1137/0108018](https://dx.doi.org/10.1137/0108018)
- [Res20] Nicolas Resch “List-decodable codes:(randomized) constructions and applications”, 2020
- [RW14] Atri Rudra and Mary Wootters “Every list-decodable code for high noise has abundant near-optimal rate puncturings” In *Symposium on Theory of Computing, STOC 2014, New York, NY, USA, May 31 - June 03, 2014* ACM, 2014, pp. 764–773 DOI: [10.1145/2591796.2591797](https://dx.doi.org/10.1145/2591796.2591797)
- [RW15] Atri Rudra and Mary Wootters “It’ll Probably Work Out: Improved List-Decoding Through Random Operations” In *Proceedings of the 2015 Conference on Innovations in Theoretical Computer Science, ITCS 2015, Rehovot, Israel, January 11-13, 2015* ACM, 2015, pp. 287–296 DOI: [10.1145/2688073.2688092](https://dx.doi.org/10.1145/2688073.2688092)
- [RW18] Atri Rudra and Mary Wootters “Average-radius list-recoverability of random linear codes” In *Proceedings of the Twenty-Ninth Annual ACM-SIAM Symposium on Discrete Algorithms* SIAM, 2018, pp. 644–662
- [ST20] Chong Shangguan and Itzhak Tamo “Combinatorial list-decoding of Reed-Solomon codes beyond the Johnson radius” In *Proceedings of the 52nd Annual ACM Symposium on Theory of Computing*, STOC 2020, 2020, pp. 538–551
- [Sri24] Shashank Srivastava “Improved List Size for Folded Reed-Solomon Codes” arXiv:2410.09031 arXiv, 2024 URL: <http://arxiv.org/abs/2410.09031>
- [TZ04] Amnon Ta-Shma and David Zuckerman “Extractor codes” In *IEEE Trans. Inf. Theory* **50.12**, 2004, pp. 3015–3025 DOI: [10.1109/TIT.2004.838377](https://dx.doi.org/10.1109/TIT.2004.838377)
- [Tam23] Itzhak Tamo “Tighter List-Size Bounds for List-Decoding and Recovery of Folded Reed-Solomon and Multiplicity Codes” arXiv:2312.17097 arXiv, 2023 URL: <http://arxiv.org/abs/2312.17097>
- [Woo13] Mary Wootters “On the List Decodability of Random Linear Codes with Large Error Rates” event-place: Palo Alto, California, USA In *Proceedings of the Forty-fifth Annual ACM Symposium on Theory of Computing*, STOC ’13 New York, NY, USA: ACM, 2013, pp. 853–860 DOI: [10.1145/2488608.2488716](https://dx.doi.org/10.1145/2488608.2488716)
- [ZP81] Victor Zyablov and Mark Pinsker “List concatenated decoding” Publisher: Russian Academy of Sciences, Branch of Informatics, Computer Equipment and … In *Problemy Peredachi Informatsii* **17.4**, 1981, pp. 29–33
