# Minimal Linear Codes Constructed from Sunflowers

Xia Wu, Wei Lu  
*Entropy*, 2023, 25(12), 1669  
DOI: 10.3390/e25121669 · PMID: 38136549 · PMCID: PMC10742731  
License: <https://creativecommons.org/licenses/by/4.0/>

## Abstract

Sunflower in coding theory is a class of important subspace codes and can be used to construct linear codes. In this paper, we study the minimality of linear codes over $F_q$ constructed from sunflowers of size *s* in all cases. For any sunflower, the corresponding linear code is minimal if $s≥q+1$, and not minimal if $2≤s≤3≤q$. In the case where $3<s≤q$, for some sunflowers, the corresponding linear codes are minimal, whereas for some other sunflowers, the corresponding linear codes are not minimal.

## 1 **Introduction**

Let $F_q$ be the finite field with *q* elements and $F_q^n$ the vector space with dimension *n* over $F_q$. For a vector $v=(v_1,…,v_n)∈F_q^n$, let Suppt$(v)$$:=\{1≤i≤n:v_i≠0\}$ be the support of $v$. The *Hamming weight* of $v$ is wt$(v)$:=#$\mathrm{Suppt}(v)$. For any two vectors $u,v∈F_q^n$, if $\mathrm{Suppt}(u)⊆\mathrm{Suppt}(v)$, we say that $v$ covers $u$ (or $u$ is covered by $v$) and write $u⪯v$. Clearly, $av⪯v$ for all $a∈F_q$.

An $[n,m]_q$ linear code $C$ over $F_q$ is an *m*-dimensional subspace of $F_q^n$. A codeword $c$ in a linear code $C$ is called *minimal* if $c$ covers only the codewords $ac$ for all $a∈F_q$, but no other codewords in $C$. If every codeword in $C$ is minimal, then $C$ is said to be a *minimal linear code*. Minimal linear codes have interesting applications in secret sharing [1,2,3,4,5] and secure two-party computation [6,7], and could be decoded with a minimum distance decoding method [8].

Up to now, there are two approaches to studying minimal linear codes. One is the algebraic method and the other is the geometric method. The algebraic method is based on the Hamming weights of the codewords. In [8], Ashikhmin and Barg gave a sufficient condition for a linear code to be minimal. Many minimal linear codes satisfying the condition $\frac{w_{min}}{w_{max}}>\frac{q−1}{q}$ are obtained from linear codes with few weights; for example [9,10]. Cohen et al. [7] provided an example to show that the condition $\frac{w_{min}}{w_{max}}>\frac{q−1}{q}$ is not necessary for a linear code to be minimal. Ding, Heng, and Zhou [11,12] derived a sufficient and necessary condition on all Hamming weights for a given linear code to be minimal.

When using the algebraic method to prove the minimality of a given linear code, one needs to know all the Hamming weights in the code, which is very difficult in general. Even if all the Hamming weights are known, it is hard to use the algebraic method to prove the minimality. In this paper, we will use the geometric approaches to study the minimality of some linear codes. Based on the geometric approaches (see [13,14,15]) it is easier to construct minimal linear codes or to prove the minimality of some linear codes (see [16,17,18,19,20,21]).

Sunflower in coding theory is a class of important subspace codes and can be used to construct linear codes, see [22]. Let *s* be the number of the elements in a sunflower. In [23], (Theorem 10), the authors proved that if $s≥p+1$, then the corresponding linear code over $F_p$ is minimal, where *p* is a prime number.

In this paper, we will use the approach used in [14] to consider the minimality of linear codes over $F_q$ constructed from sunflowers for all *s*. We obtain the following three results: (1) when $s≥q+1$, for any sunflower, the corresponding linear code is minimal; (2) when $2≤s≤3≤q$, for any sunflower, the corresponding linear code is not minimal; (3) when $3<s≤q$, for some sunflowers, the corresponding linear codes are minimal, wherea for some other sunflowers, the corresponding linear codes are not minimal.

This paper is organized as follows. In Section 2, we introduce some basic knowledge about sunflowers, Euclidean inner product, and minimal linear codes. In Section 3, we consider the linear codes constructed from sunflowers and discuss the minimality of these linear codes in three cases. In Section 4, we conclude this paper.

## 2 **Preliminaries**

### 2.1 Sunflower

Throughout this paper, let *k* and $t_0$ be two positive integers, $m=2k+t_0$ and $l=k+t_0$. Let $2≤s≤q^k+1$ be a positive integer, $T_0≤F_q^m$ be a subspace of $F_q^m$, and $\mathrm{dim}T_0=t_0$. We denote $G_q(l,m)$ the set of *l*-dimensional vector subspaces of $F_q^m$. We define

$$
Φ=\{E_i≤F_q^m: \mathrm{dim}E_i=l, E_i∩E_j=T_0, 1≤i≠j≤s\}.
$$

Then, $Φ⊆G_q(l,m)$ is a *sunflower* of $F_q^m$ and the space $T_0$ is called the center of the sunflower $Φ$.

> **Lemma 1.**
>
> *Let $Φ⊆G_q(l,m)$ be a sunflower and $T_0$ the center of Φ. For any $E_i$, $E_j∈Φ$ with $1≤i≠j≤s,$ we have $F_q^m=E_i+E_j$.*

> **Proof.**
>
> Since
>
> $$
> \begin{matrix}dim(E_i+E_j) & =dim(E_i)+dim(E_j)−dim(E_i∩E_j) \\ & =dim(E_i)+dim(E_j)−dim(T_0) \\ & =l+l−t_0=m\end{matrix}
> $$
>
> and $E_i+E_j≤F_q^m$, we have $F_q^m=E_i+E_j$. □

> **Lemma 2.**
>
> *Let $Φ⊆G_q(l,m)$ be a sunflower and $T_0$ the center of Φ. For any $E_i$, $E_j∈Φ$ with $1≤i≠j≤s,$ we have $E_i^⊥∩E_j^⊥=\{0\}$.*

> **Proof.**
>
> Assume that $z∈E_i^⊥∩E_j^⊥$. It follows from Lemma 1 that $z∈(F_q^m)^⊥$, which implies $z=0$. □

### 2.2 Euclidean Inner Product

Let *m* be a positive integer. For $x=(x_1,x_2,…,x_m)$, $y=(y_1,y_2,…,y_m)∈ F_q^m$, the *Euclidean inner product* of $x$ and $y$ is given by

$$
<x,y>:=xy^T=∑_{i=1}^mx_iy_i.
$$

For any $S⊆F_q^m$, we define

$$
\mathrm{Span}(S):={∑_{i=1}^rλ_is_i | r∈N,s_i∈S,λ_i∈F_q},
$$

$$
S^⊥:=\{v∈F_q^m | \mathrm{vs}^T=0, \mathrm{for} \mathrm{any} s∈S\}.
$$

Then, Span$(S)$ and $S^⊥$ are vector spaces over $F_q$ and

$$
\mathrm{dim}(\mathrm{Span}(S))+\mathrm{dim}(S^⊥)=m. \tag{1}
$$

### 2.3 Minimal Linear Codes

All linear codes can be constructed by the following way. Let $m≤n$ be two positive integers. Let $G:=[d_1,…,d_n]$ be an $m×n$ matrix over $F_q$ and $D:=\{d_1,…,d_n\}$ be a multiset. Let $r(D)=r(G)$ denote the rank of *G*, which is equal to the dimension of the vector space Span$(D)$ over $F_q$. Let

$$
C(D):={c(x)=xG=(\mathrm{xd}_1^T,…,\mathrm{xd}_n^T),x∈F_q^m}.
$$

Then, $C(D)$ is an $[n$, $r(D)]_q$ linear code with generator matrix *G*. We always study the minimality of $C(D)$ by considering some appropriate multisets *D*.

To present the sufficient and necessary condition for minimal linear codes in [14], some concepts are needed. For any $y∈F_q^m$, we define

$$
H(y):=y^⊥=\{x∈F_q^m∣\mathrm{xy}^T=0\},
$$

$$
H(y,D):=D∩H(y)=\{x∈D∣\mathrm{xy}^T=0\},
$$

$$
V(y,D):=\mathrm{Span}(H(y,D)).
$$

It is obvious that $H(y,D)⊆V(y,D)⊆H(y)$.

> **Proposition 1**
>
> ([14]). *For any $x,y∈F_q^m, c(x)⪯c(y)$ if and only if $H(y,D)⊆H(x,D)$.*

Let $y∈F_q^m∖\{0\}$. The following lemma gives a sufficient and necessary condition for the codeword $c(y)∈C(D)$ to be minimal.

> **Lemma 3**
>
> ([14] (Theorem 3.1)). *Let $y∈F_q^m∖\{0\}$. Then, the following three conditions are equivalent:*
>
> - (1) *$c(y)$ is minimal in $C(D)$;*
> - (2) *$\mathrm{dim}V(y,D)=m−1$;*
> - (3) *$V(y,D)=H(y)$.*

The following lemma gives a sufficient and necessary condition for linear codes over $F_q$ to be minimal.

> **Lemma 4**
>
> ([14] (Theorem 3.2)). *The following three conditions are equivalent:*
>
> - (1) *$C(D)$ is minimal;*
> - (2) *for any $y∈F_q^m∖\{0\}$, $\mathrm{dim}$$V(y,D)=m−1$;*
> - (3) *for any $y∈F_q^m∖\{0\}$, $V(y,D)=H(y)$.*

By the following lemma, we can obtain infinity of many minimal linear codes from any known minimal linear codes.

> **Lemma 5**
>
> ([14] (Proposition 4.1)). *Let $D_1⊆D_2$ be two multisets with elements in $F_q^m$ and $r(D_1)=r(D_2)=m$. If $C(D_1)$ is minimal, then $C(D_2)$ is minimal.*

The following corollary is trivial.

> **Corollary 1.**
>
> *Let $D_1⊆D_2$ be two multisets with elements in $F_q^m$ and $r(D_1)=r(D_2)=m$. If $C(D_2)$ is not minimal, then $C(D_1)$ is not minimal.*

In the following section, we will use the above lemmas to consider the minimality of linear codes constructed from sunflowers.

## 3 The Minimality of Linear Codes Constructed from Sunflowers

In this section, we consider the linear codes constructed from sunflowers and discuss the minimality of these linear codes.

Let

$$
Φ=\{E_i≤F_q^m: \mathrm{dim}E_i=l,E_i∩E_j=T_0,1≤i≠j≤s\}.
$$

be a sunflower of $F_q^m$ and $T_0$ the center of $Φ$.

Let

$$
D:=(⋃_{i=1}^sE_i)∖T_0=⋃_{i=1}^s(E_i∖T_0). \tag{2}
$$

It is easy to see that $C(D)$ is a $[s(q^l−q^{t_0}),m]_q$ linear code.

The following lemmas are important in the proofs of this section.

> **Lemma 6**
>
> ([24] (Lemma 3.1)). *For all $y∈F_q^m∖\{0\}$, $E≤F_q^m$ and dim$(E)=r$, we have $H(y,E)=V(y,E)$ and*
>
> $$
> \mathrm{dim}V(y,E)={\begin{matrix} & r, & if y∈E^⊥; \\ & r−1, & if y∉E^⊥.\end{matrix}
> $$

By linear algebra, we can obtain the following lemma.

> **Lemma 7.**
>
> *Let $y∈F_q^m∖\{0\}$. If for any $E_i∈Φ$, $y∉E_i^⊥$, $1≤i≤s$. For any $E_{i_0}$, $E_{j_0}∈Φ$, $E_{i_0}≠E_{j_0}$, let $D_1=(E_{i_0}∪E_{j_0})∖T_0$. We have*
>
> $$
> \mathrm{rank}H(y,D_1)={\begin{matrix} & m−2, & if y∈T_0^⊥; \\ & m−1, & if y∉T_0^⊥.\end{matrix}
> $$

> **Proof.**
>
> Since $y∉E_i^⊥$, it follows from Lemma 6 that $\mathrm{dim}H(y,E_{i_0})=\mathrm{dim}H(y,E_{j_0})=l−1$. Note that $H(y,T_0)≤H(y,E_{i_0})$ and $H(y,T_0)≤H(y,E_{j_0}).$
>
> If $y∈T_0^⊥$, then $H(y,T_0)=T_0$. Suppose that
>
> $$
> \begin{matrix}H(y,T_0)=T_0=\mathrm{Span}\{γ_1,γ_2,…,γ_{t_0}\}, \\ H(y,E_{i_0})=\mathrm{Span}\{α_1,α_2,…,α_{k−1},γ_1,γ_2,…,γ_{t_0}\}, \\ H(y,E_{j_0})=\mathrm{Span}\{β_1,β_2,…,β_{k−1},γ_1,γ_2,…,γ_{t_0}\}.\end{matrix}
> $$
>
> Then, we have
>
> $$
> \begin{matrix} & H(y,E_{i_0})∖T_0⊇\{α_1,α_2…,α_{k−1},α_1+γ_1,α_1+γ_2,…,α_1+γ_{t_0}\}, \\ & H(y,E_{j_0})∖T_0⊇\{β_1,β_2,…,β_{k−1},β_1+γ_1,β_1+γ_2,…,β_1+γ_{t_0}\}.\end{matrix}
> $$
>
> Since $H(y,D_1)=(H(y,E_{i_0})∪H(y,E_{j_0}))∖T_0$, the above equations lead to
>
> $$
> H(y,D_1)⊇\{α_1,α_2,…,α_{k−1},β_1,β_2,…,β_{k−1},α_1+γ_1,α_1+γ_2,…,α_1+γ_{t_0}\},
> $$
>
> i.e., $\mathrm{rank}H(y,D_1)=m−2$.
>
> If $y∉T_0^⊥$, then $\mathrm{dim}H(y,T_0)=t_0−1$ by Lemma 6. Suppose that
>
> $$
> \begin{matrix}H(y,T_0)=\mathrm{Span}\{γ_1,γ_2,…,γ_{t_0−1}\}, \\ T_0=\mathrm{Span}\{γ_1,γ_2,…,γ_{t_0−1},γ_{t_0}\}, \\ H(y,E_{i_0})=\mathrm{Span}\{α_1,α_2,…,α_k,γ_1,γ_2,…,γ_{t_0−1}\}, \\ H(y,E_{j_0})=\mathrm{Span}\{β_1,β_2,…,β_k,γ_1,γ_2,…,γ_{t_0−1}\}.\end{matrix}
> $$
>
> Then, we have
>
> $$
> \begin{matrix} & H(y,E_{i_0})∖T_0⊇\{α_1,α_2…,α_k,α_1+γ_1,α_1+γ_2,…,α_1+γ_{t_0−1}\}, \\ & H(y,E_{j_0})∖T_0⊇\{β_1,β_2,…,β_k,β_1+γ_1,β_1+γ_2,…,β_1+γ_{t_0−1}\}.\end{matrix}
> $$
>
> Since $H(y,D_1)=(H(y,E_{i_0})∪H(y,E_{j_0}))∖T_0$, the above equations yield
>
> $$
> H(y,D_1)⊇\{α_1,α_2,…,α_k,β_1,β_2,…,β_k,α_1+γ_1,α_1+γ_2,…,α_1+γ_{t_0−1}\},
> $$
>
> i.e., $\mathrm{rank}H(y,D_1)=m−1$. The proof is completed. □

Now, we consider the minimality of $C(D)$ in three cases. First, when $s≥q+1$, we have

> **Theorem 1.**
>
> *Let $Φ=\{E_1,…,E_s\}$ be a sunflower of $F_q^m$ with center $T_0$ of dimension $t_0$. If $s≥q+1$, then $C(D)$ is an $[s(q^l−q^{t_0}),m]_q$ minimal linear code.*

> **Proof.**
>
> According to Lemma 4, we only need to prove that for any $y∈F_q^m∖\{0\}$, $\mathrm{dim}V(y,D)=m−1$. By (2), we obtain
>
> $$
> H(y,D)=D∩H(y)=⋃_{i=1}^s(H(y,E_i)∖T_0). \tag{3}
> $$
>
> There are three cases:
>
> (1) If there exists $E_{i_0}∈Φ$ such that $y∈E_{i_0}^⊥$, then we have $\mathrm{dim}H(y,E_{i_0})=l$ from Lemma 6. According to Lemma 2, for any $E_{j_0}∈Φ$ with $E_{j_0}≠E_{i_0}$, we have $y∉E_{j_0}^⊥.$ Then, it follows from Lemma 6 that $\mathrm{dim}H(y,E_{j_0})=l−1.$ Since $y∈E_{i_0}^⊥⊆T_0^⊥$, we have $H(y,T_0)=T_0$. We set
>
> $$
> H(y,T_0)=T_0=\mathrm{Span}\{γ_1,γ_2,…,γ_{t_0}\}.
> $$
>
> When $k=1$, we set
>
> $$
> H(y,E_{i_0})=\mathrm{Span}\{α_1,γ_1,γ_2,…,γ_{t_0}\}.
> $$
>
> By (3), we have $H(y,D)⊇\{α_1,α_1+γ_1,α_1+γ_2,…,α_1+γ_{t_0}\}$, and so $\mathrm{dim}V(y,D)=m−1$.
>
> When $k>1$, we set
>
> $$
> H(y,E_{i_0})=\mathrm{Span}\{α_1,α_2,…,α_k,γ_1,γ_2,…,γ_{t_0}\},
> $$
>
> and
>
> $$
> H(y,E_{j_0})=\mathrm{Span}\{β_1,β_2,…,β_{k−1},γ_1,γ_2,…,γ_{t_0}\}.
> $$
>
> By (3), we have
>
> $$
> H(y,D)⊇\{α_1,α_2,…,α_k,β_1,β_2,…,β_{k−1},α_1+γ_1,α_1+γ_2,…,α_1+γ_{t_0}\}.
> $$
>
> Since
>
> $$
> \mathrm{rank}\{α_1,α_2,…,α_k,β_1,β_2,…,β_{k−1},α_1+γ_1,α_1+γ_2,…,α_1+γ_{t_0}\}=m−1,
> $$
>
> it is easy to obtain $\mathrm{dim}V(y,D)=m−1$.
>
> (2) If for any $E_i∈Φ$, $1≤i≤s$, we have $y∉E_i^⊥$ and $y∉T_0^⊥$, then $\mathrm{dim}H(y,E_{i_0})=$ dim$H(y,E_{j_0})=l−1$ for any $E_{i_0},E_{j_0}∈Φ$ with $E_{i_0}≠E_{j_0}$. Since $y∉T_0^⊥$, $\mathrm{dim}H(y,T_0)=t_0−1.$ We set
>
> $$
> H(y,T_0)=\mathrm{Span}\{γ_1,γ_2,…,γ_{t_0−1}\}, T_0=\mathrm{Span}\{γ_1,γ_2,…,γ_{t_0}\}.
> $$
>
> When $k=1$, we set
>
> $$
> H(y,E_{i_0})=\mathrm{Span}\{α_1,γ_1,γ_2,…,γ_{t_0−1}\}, H(y,E_{j_0})=\mathrm{Span}\{β_1,γ_1,γ_2,…,γ_{t_0−1}\}.
> $$
>
> Then,
>
> $$
> H(y,D)⊇\{α_1,β_1,α_1+γ_1,α_1+γ_2,…,α_1+γ_{t_0−1}\}.
> $$
>
> Since
>
> $$
> \mathrm{rank}\{α_1,β_1,α_1+γ_1,α_1+γ_2,…,α_1+γ_{t_0−1}\}=m−1,
> $$
>
> it is easy to obtain $\mathrm{dim}V(y,D)=m−1$.
>
> When $k>1$, let $D_1=(E_{i_0}∪E_{j_0})∖T_0$. By Lemma 7, we have rank$(H(y,D_1))=m−1,$ thus $\mathrm{dim}V(y,D)=m−1.$
>
> (3) If for any $E_i∈Φ$, $1≤i≤s$, we have $y∉E_i^⊥$ and $y∈T_0^⊥$; then, it follows from Lemma 6 that $\mathrm{dim}H(y,E_i)=l−1$ and $\mathrm{dim}H(y,T_0)=t_0.$
>
> When $k=1$, we obtain $\mathrm{dim}T_0^⊥$=2 and $\mathrm{dim}E_i^⊥$=1, $1≤i≤s$, then $E_i^⊥$ is the one-dimensional subspace of $T_0^⊥$. There are $q+1$ one dimensional subspace of $T_0^⊥$, since $s≥q+1$, we obtain $s=q+1$. By Lemma 2, for any $E_i$, $E_j∈Φ$, $E_i≠E_j$, we have $E_i^⊥∩E_j^⊥=\{0\}$. Thus,
>
> $$
> T_0^⊥=⋃_{i=1}^sE_i^⊥. \tag{4}
> $$
>
> Since $y∈T_0^⊥$, by (4), there exists $E_j∈Φ,$ such that $y∈E_j^⊥,$ a contradiction. So $k≠1$.
>
> When $k>1$, we have $\mathrm{dim}H(y,E_1)$=dim$H(y,E_2)=l−1.$ Let $D_1=(E_1∪E_2)∖T_0$. By Lemma 7, we have rank$(H(y,D_1))=m−2.$ We set
>
> $$
> T_0=H(y,T_0)=\mathrm{Span}\{γ_1,γ_2,…,γ_{t_0}\}.
> $$
>
> $$
> E_1=\mathrm{Span}\{α_1,α_2,…,α_{k−1},α_k,γ_1,γ_2,…,γ_{t_0}\}, H(y,E_1)=\mathrm{Span}\{α_1,α_2,…,α_{k−1},γ_1,γ_2,…,γ_{t_0}\}.
> $$
>
> $$
> E_2=\mathrm{Span}\{β_1,β_2,…,β_{k−1},β_k,γ_1,γ_2,…,γ_{t_0}\}, H(y,E_2)=\mathrm{Span}\{β_1,β_2,…,β_{k−1},γ_1,γ_2,…,γ_{t_0}\}.
> $$
>
> Let
>
> $$
> B=\{α_1,α_2,…,α_{k−1},β_1,β_2,…,β_{k−1},α_1+γ_1,α_1+γ_2,…,α_1+γ_{t_0}\}.
> $$
>
> Then, rank$B=m−2$ and $B⊆H(y,D)$. Let $V=F_q^m$, $W=\mathrm{Span}(B)$ and $\bar{V}=V/W$ the quotient space of *V* over *W*. We have $\mathrm{dim}\bar{V}=2$ and $V=$Span$\{\bar{α_k},\bar{β_k}\}$. Let $π$ be the standard map from *V* to $\bar{V}$. For any $E_i∈Φ$, $1≤i≤s$, $π(E_i)$ is a subspace of $\bar{V}$. It is easily seen that $\mathrm{dim}π(E_i)=1$ or 2. There are the following two cases.
>
> (i) If there exists $E_{i_0}∈Φ$ such that $\mathrm{dim}π(E_{i_0})=2$, then $π(E_{i_0})=\bar{V}$. There must exist $α∈E_{i_0}$ such that
>
> $$
> π(α)=\bar{α_k−bβ_k}, \mathrm{where} b=(α_ky^T)/(β_ky^T).
> $$
>
> So, $α=α_k−bβ_k+w$, where $w∈W$. It is simply checked that $α∉T_0$, $α∈H(y)$ and $α∉W$. We obtain
>
> $$
> (B∪\{α\})⊆H(y,D), \mathrm{rank}(B∪\{α\})=m−1.
> $$
>
> Thus, $\mathrm{dim}V(y,D)=m−1$.
>
> (ii) If for any $E_i∈Φ$ we have $\mathrm{dim}π(E_i)=1$, combining that $V=E_i+E_j$ for any $E_i$, $E_j∈Φ$ with $E_i≠E_j$ in accordance with Lemma 1, we have
>
> $$
> \bar{V}=π(V)=π(E_i)+π(E_j) \mathrm{and} π(E_i)≠π(E_j).
> $$
>
> Since $\bar{V}$ has only $q+1$ one-dimensional subspace and $s≥q+1$, we have $s=q+1$ and $\bar{V}=⋃_{i=1}^sπ(E_i)$. There must exist $E_{j_0}∈Φ$ such that
>
> $$
> π(E_{j_0})=\mathrm{Span}\{\bar{α_k−bβ_k}\}, \mathrm{where} b=(α_ky^T)/(β_ky^T).
> $$
>
> Hence, there exists $α=α_k−bβ_k+w∈E_{j_0}$, where $w∈W$, such that $π(α)=\bar{α_k−bβ_k}$. One can easily deduce that $α∉T_0$, $α∈H(y)$ and $α∉W$. We obtain
>
> $$
> (B∪\{α\})⊆H(y,D), \mathrm{rank}(B∪\{α\})=m−1.
> $$
>
> Thus, $\mathrm{dim}V((y),D)=m−1$.
>
> In conclusion, for any $y∈F_q^m∖\{0\},$ we have $\mathrm{dim}V(y,D)=m−1$, so $C(D)$ is a minimal linear code. □

> **Remark 1.**
>
> *In Theorem 1, if $q=p$ is a prime number, then it becomes [23] (Theorem 10). So Theorem 1 is a generalization of [23] (Theorem 10). Our method is different from theirs. When $s≤q$, our method also can be used to study the minimality of the linear codes, whereas theirs can not.*

> **Example 1.**
>
> *Let $e_1,…,e_m$ be the standard basis of $F_q^m$. Let*
>
> $$
> T_0^′=\mathrm{Span}(\{e_{2k+1},e_{2k+2},…,e_m\})=\{(0,0,t)|t∈F_q^{t_0}\}. \tag{5}
> $$
>
> *For any $b∈F_q$, we define*
>
> $$
> E_b=\mathrm{Span}\{e_1+be_{k+1},e_2+be_{k+2},…,e_k+be_{2k},e_{2k+1},…,e_m\}. \tag{6}
> $$
>
> *Suppose that*
>
> $$
> Φ=\{E_b|b∈F_q\}∪\mathrm{Span}\{e_{k+1},e_{k+2},…,e_{2k},e_{2k+1},…,e_m\}
> $$
>
> *and*
>
> $$
> D^′=\underset{E_i∈Φ}{⋃}(E_i∖T_0^′).
> $$
>
> *It is easy to see that Φ is a sunflower of $F_q^m$ with center $T_0^′$ and $s=q+1$. Here, we take $q=4,k=3$, and $t_0=1$. With the help of Magma, we verify that the code $C(D^′)$ is a minimal $[1260,7]_4$ linear code with minimum distance 768, and*
>
> $$
> \frac{w_{\mathrm{min}}}{w_{\mathrm{max}}}=\frac{4}{5}>\frac{3}{4}.
> $$

Now, we consider the minimality of $C(D)$ when $2≤s≤3≤q$. If $s=3$, we have

> **Theorem 2.**
>
> *Let $Φ=\{E_1,…,E_s\}$ be a sunflower of $F_q^m$ with center $T_0$ of dimension $t_0$. If $s=3≤q$, then $C(D)$ is not minimal.*

> **Proof.**
>
> To prove $C(D)$ is not minimal, by Lemma 4, we only need to prove there exists $y_0∈F_q^m∖\{0\}$ such that $\mathrm{dim}V(y_0,D)≤m−2.$
>
> When $s=3$, $Φ=\{E_1,E_2,E_3\}$. By Lemma 2 we know $E_1^⊥∩E_2^⊥=\{0\}$. Then, for any $y_1∈E_2^⊥∖\{0\}$, we have $y_1∉E_1^⊥$ and $y_1∈T_0^⊥$. Thus, $\mathrm{dim}H(y_1,E_1)=l−1$, $\mathrm{dim}H(y_1,E_2)=l$, and $\mathrm{dim}H(y_1,T_0)=t_0$. We set
>
> $$
> T_0=H(y_1,T_0)=\mathrm{Span}\{γ_1,γ_2,…,γ_{t_0}\},
> $$
>
> $$
> E_1=\mathrm{Span}\{α_1,α_2,…,α_{k−1},α_k,γ_1,γ_2,…,γ_{t_0}\}, H(y_1,E_1)=\mathrm{Span}\{α_1,α_2,…,α_{k−1},γ_1,γ_2,…,γ_{t_0}\},
> $$
>
> $$
> E_2=H(y_1,E_2)=\mathrm{Span}\{β_1,β_2,…,β_k,γ_1,γ_2,…,γ_{t_0}\},
> $$
>
> where $α_ky_1^T=1$. Let
>
> $$
> E_1^′=\mathrm{Span}\{α_1,α_2,…,α_k\}, E_2^′=\mathrm{Span}\{β_1,β_2,…,β_k\},
> $$
>
> we have $F_q^m=E_1^′⊕E_2^′⊕T_0.$ For any $η∈E_3,$ there exist unique $α∈E_1^′$, $β∈E_2^′,γ∈T_0$, such that $η=α+β+γ.$ Since $α+β=η−γ∈E_3$, for any $α∈E_1^′$, there exists unique $β∈E_2^′$ such that $α+β∈E_3$. Let $φ$ be a map from $E_1^′$ to $E_2^′$ satisfying $φ(α)=β$. We can see $φ$ is an isomorphism from $E_1^′$ to $E_2^′$ and
>
> $$
> E_3=\{x+φ(x)|x∈E_1^′\}⊕T_0=E_3^′⊕T_0.
> $$
>
> Since $y_1∉E_1^⊥$, $y_1∈T_0^⊥$, and $E_1=E_1^′⊕T_0$, we have $y_1∉(E_1^′)^⊥$, $\mathrm{dim}H(y_1,E_1^′)=k−1,$$\mathrm{dim}φ(H(y_1,E_1^′))=k−1$, and $\mathrm{dim}φ(H(y_1,E_1^′))^⊥=m−(k−1)=k+t_0+1.$ Thus,
>
> $$
> \begin{matrix} & \mathrm{dim}(φ(H(y_1,E_1^′))^⊥∩E_1^⊥) \\ = & \mathrm{dim}φ(H(y_1,E_1^′))^⊥+\mathrm{dim}(E_1^⊥)−\mathrm{dim}(φ(H(y_1,E_1^′))^⊥+E_1^⊥) \\ ≥ & k+t_0+1+k−m=1.\end{matrix}
> $$
>
> Since $q≥3$, there exists $y_2∈(φ(H(y_1,E_1^′))^⊥∩E_1^⊥)∖\{0\}$ such that $φ(α_k)y_2^T≠−1$. It is easy to see $y_2∉E_2^⊥$ and $y_2∈T_0^⊥.$ Let $y_0=y_1+y_2$, we obtain $y_0∉E_1^⊥$, $y_0∉E_2^⊥$, and $y_0∈T_0^⊥$. Since $α_k+φ(α_k)∈E_3$ and
>
> $$
> \begin{matrix}(α_k+φ(α_k))y_0^T & =(α_k+φ(α_k))(y_1+y_2)^T \\ & =α_ky_1^T+α_ky_2^T+φ(α_k)y_1^T+φ(α_k)y_2^T \\ & =1+0+0+φ(α_k)y_2^T≠0,\end{matrix}
> $$
>
> we obtain $y_0∉E_3^⊥.$ Thus, $y_0∉E_i^⊥, 1≤i≤3$ and $\mathrm{dim}H(y_0,E_i)=l−1.$
>
> (1) When $k=1$, $\mathrm{dim}H(y_0,E_i)=t_0$, since $T_0≤H(y_0,E_i)$, we have $T_0=H(y_0,E_i)$. Thus,
>
> $$
> H(y_0,D)=⋃_{i=1}^3(H(y,E_i)∖T_0)=∅.
> $$
>
> Thus, $C(D)$ is not minimal.
>
> (2) When $k>1$, since $E_i=E_i^′⊕T_0$, we have $y_0∉(E_i^′)^⊥$ and $\mathrm{dim}H(y_0,E_i^′)=k−1.$ Thus,
>
> $$
> H(y_0,E_i)=H(y_0,E_i^′)⊕T_0, 1≤i≤3.
> $$
>
> By Lemma 6, it is easily verified that
>
> $$
> H(y_0,E_1^′)=H(y_1,E_1^′),
> $$
>
> $$
> H(y_0,E_2^′)=H(y_2,E_2^′)=φ(H(y_1,E_1^′))=φ(H(y_0,E_1^′)),
> $$
>
> $$
> H(y_0,E_3^′)=\{x+φ(x)|x∈H(y_0,E_1^′)\}⊆\mathrm{Span}(H(y_0,E_1^′)∪H(y_0,E_2^′)).
> $$
>
> Then, $\mathrm{dim}V(y_0,D)=m−2$. By Lemma 4, we have that $c(y_0)$ is not minimal. □

Combining Theorem 2 and Corollary 1, we have

> **Corollary 2.**
>
> *Let $Φ=\{E_1,…,E_s\}$ be a partial spread of $F_q^m$. If $2≤s≤3≤q$, then $C(D)$ is not minimal.*

Now, we consider the minimality of $C(D)$ when $4≤s≤q$. We recall from (5) that

$$
T_0^′=\mathrm{Span}(\{e_{2k+1},e_{2k+2},…,e_m\})=\{(0,0,t)|t∈F_q^{t_0}\}.
$$

We will show that some sunflowers $Φ$ with center $T_0^′$, $C(D)$ are minimal, whereas some other sunflowers $Φ$ with center $T_0^′$, $C(D)$ are not minimal.

First, we construct some sunflowers $Φ$ such that $C(D)$ are minimal. Let $k≥2$, $f(x)$ be an irreducible polynomial in $F_q[x]$ of degree *k* and $M∈F_q^{k×k}$ be a matrix with characteristic polynomial $f(x)$. We define

$$
\begin{matrix} & E_1=\{(x,0,t)|x∈F_q^k,t∈F_q^{t_0}\},E_2=\{(0,x,t)|x∈F_q^k,t∈F_q^{t_0}\}, \\ & E_3=\{(x,x,t)|x∈F_q^k,t∈F_q^{t_0}\},E_4=\{(x,xM,t)|x∈F_q^k,t∈F_q^{t_0}\},\end{matrix} \tag{7}
$$

and

$$
Φ=\{E_1,E_2,E_3,E_4\}. \tag{8}
$$

We can see $Φ$ is a sunflower with center $T_0^′$.

> **Theorem 3.**
>
> *For the sunflower *Φ* defined in (8), the linear code $C(D)$ is minimal.*

> **Proof.**
>
> According to Lemma 4, we only need to prove that for any $y∈F_q^m∖\{0\}$, $\mathrm{dim}V(y,D)=m−1$. There are three cases:

- (1) If there exists $E_{i_0}∈Φ$ such that $y∈E_{i_0}^⊥$, the proof is similar as that in Theorem 1 (1).
- (2) If for any $E_i∈Φ$, $1≤i≤s$, we have $y∉E_i^⊥$ and $y∉T_0^{′⊥}$, then the proof is similar to that in Theorem 1 (2).
- (3) If for any $E_i∈Φ$, $1≤i≤s$, we have $y∉E_i^⊥$ and $y∈T_0^{′⊥}$, the proof is as follows. Let $y=(y_1,y_2,y_3)$ where $y_1,y_2∈F_q^k,y_3∈F_q^{t_0}$. Next, we define two linear transformations $φ$, $ψ$ from $F_q^k$ to $F_q^k$:

  $$
  φ(x)=x,ψ(x)=xM,x∈F_q^k. \tag{9}
  $$

  Then,

  $$
  \begin{matrix} & E_3=\{(x,φ(x),t)|x∈F_q^k,t∈F_q^{t_0}\},E_4=\{(x,φ(x),t)|x∈F_q^k,t∈F_q^{t_0}\}.\end{matrix} \tag{10}
  $$

  Let

  $$
  \begin{matrix} & E_1^′=\{(x,0,0)|x∈F_q^k\},E_2^′=\{(0,x,0)|x∈F_q^k\}, \\ & E_3^′=\{(x,φ(x),0)|x∈F_q^k\},E_4^′=\{(x,ψ(x),0)|x∈F_q^k\}.\end{matrix} \tag{11}
  $$

  It is easy to verify that

  $$
  E_i=E_i^′⊕T_0^′, 1≤i≤4.
  $$

  Let

  $$
  \begin{matrix}S: & =\mathrm{Span}\{H(y,E_1)∪H(y,E_2)\} \\ & =\mathrm{Span}\{\{H(y,E_1)∪H(y,E_2)\}∖T_0^′\} \\ & =\{(α,β,0)|α∈H(y,E_1),β∈H(y,E_2)\}⊕\{(0,0,t)|t∈F_q^{t_0}\} \\ & =S^′⊕T_0^′.\end{matrix} \tag{12}
  $$

  By Lemma 7, we have dim.

Now, we prove $H(y,E_3)⊈S$ or $H(y,E_4)⊈S.$ If not, assume that $H(y,E_3)⊆S$ and $H(y,E_4)⊆S$. By $H(y,E_3)⊆S$, it is obvious that $H(y,E_3^′)⊆S^′$. Since $y∉E_3^⊥$ and $y∈T_0^{′⊥}$, we have $y∉E_3^{′⊥}$, and then $\mathrm{dim}H(y,E_3^′)=k−1.$ There exists $α_1,…,α_{k−1}∈H(y_1)$, $β_1,…,β_{k−1}∈H(y_2)$ such that $(α_1,β_1,0),…,(α_{k−1},β_{k−1},0)$ is a basis of $H(y,E_3^′)$. Then, (10) yields $β_i=φ(α_i)$. It is effortlessly demonstrated that $α_1,…,α_{k−1}$ is a basis of $H(y_1)$, and $β_1,…,β_{k−1}$ is a basis of $H(y_2)$. Thus,

$$
φ(H(y_1))=H(y_2).
$$

Similarly, by $H(y,E_4)⊆S$, we obtain

$$
ψ(H(y_1))=H(y_2).
$$

Then, we have

$$
ψ(H(y_1))=H(y_2)=φ(H(y_1))=H(y_1).
$$

That is to say, $H(y_1)$ is the $ψ$-$\mathrm{invariant} \mathrm{subspace}$ of $F_q^k$.

Let $α_1,…,α_{k−1},α_k$ be a basis of $F_q^k$, where $α_1,…,α_{k−1}$ is a basis of $H(y_1)$. Then, the matrix of $ψ$ with respect to this basis is

$$
B=(\begin{matrix}B_1 & B_2 \\ 0 & b\end{matrix}),
$$

where $B_1$ is the matrix of $ψ|H(y_1)$ with respect to $α_1,…,α_{k−1}$. Note that *M* is the matrix of $ψ$ with respect to the standard basis, and thus *M* and *B* are similar and have the same characteristic polynomial. So

$$
f(x)=|xI−B_1|(x−b),
$$

a contradiction with the irreducibility of $f(x)$. Hence, $H(y,E_3)⊈S$ or $H(y,E_4)⊈S$. It is easy to see that $r(\{H(y,E_1)∪H(y,E_2)∪H(y,E_3)\}∖T_0^′)=m−1$ or $r(\{H(y,E_1)∪H(y,E_2)∪H(y,E_4)\}∖T_0^′)=m−1$. So, $\mathrm{dim}V(y,D)=m−1$.

In conclusion, for any $y∈F_q^m∖\{0\}$, $\mathrm{dim}V(y,D)=m−1$. By Lemma 4, $C(D)$ is minimal. □

Combining Theorem 3 and Lemma 5, we have

> **Corollary 3.**
>
> *Let $s≥4$ and $Φ=\{E_1,…,E_s\}$ be a sunflower of $F_q^m$ with center $T_0^′$. If $\{E_1,E_2,E_3,E_4\}$ are defined as (7), then $C(D)$ is minimal.*

> **Example 2.**
>
> *Take $q=5,k=2$, and $t_0=1$. Let $f(x)=x^2+x+1$ and*
>
> $$
> M=(\begin{matrix}0 & −1 \\ 1 & −1\end{matrix}).
> $$
>
> *It is easily checked that $f(x)∈F_q[x]$ is an irreducible polynomial of degree 2 and the characteristic polynomial of M. Then, the code $C(D)$ constructed based on Theorem 3 is a minimal $[480,5]_5$ linear code with minimum distance 300, and*
>
> $$
> \frac{w_{\mathrm{min}}}{w_{\mathrm{max}}}=\frac{3}{4}<\frac{4}{5}.
> $$

Now, we construct some sunflowers $Φ$ with center $T_0^′$ such that $C(D)$ are not minimal. Let us recall from (6) that

$$
E_b=\mathrm{Span}\{e_1+be_{k+1},e_2+be_{k+2},…,e_k+be_{2k},e_{2k+1},…,e_m\}.
$$

Let

$$
Φ=\{E_b|b∈F_q\}. \tag{13}
$$

It is easy to see that $Φ$ is a sunflower of $F_q^m$ with center $T_0^′$.

> **Theorem 4.**
>
> *For the sunflower Φ defined in (13), the linear code $C(D)$ is not minimal.*

> **Proof.**
>
> Let $y_0=e_1$. Then, for any $b∈F_q$, we obtain
>
> $$
> \begin{matrix}H(y_0,E_b) & =\mathrm{Span}\{e_2+be_{k+2},…,e_k+be_{2k},e_{2k+1},…,e_m\} \\ & ⊆\mathrm{Span}\{e_2,…,e_k,e_{k+2},…,e_{2k},e_{2k+1},…,e_m\}.\end{matrix}
> $$
>
> By (3), we have
>
> $$
> H(y_0,D)⊆\mathrm{Span}(\{e_2,…,e_k,e_{k+2},…,e_{2k},e_{2k+1},…,e_m\}).
> $$
>
> Then, $\mathrm{dim}V(y_0,D)≤m−2$. By Lemma 4, we have that $c$$(y_0)$ is not minimal and $C(D)$ is not minimal. □

Combining Theorem 4 and Corollary 1, we have

> **Corollary 4.**
>
> *Let $3<s≤q$ and $S⊆F_q$ where $#S=s$. Let $Φ=\{E_b| b∈S\}$. Then, $C(D)$ is not minimal.*

> **Remark 2.**
>
> *In Theorem 3, Corollary 3, Theorem 4, and Corollary 4, the center of the sunflower Φ is the special subspace $T_0^′$. When the center is a general subspace, we have not yet proved the minimality of $C(D)$.*

> **Example 3.**
>
> *Take $q=3,k=2$, and $t_0=2$. Then, the code $C(D)$ constructed based on Theorem 4 is $[216,6]_3$ linear code with minimum distance 108, and*
>
> $$
> \frac{w_{\mathrm{min}}}{w_{\mathrm{max}}}=\frac{2}{3}.
> $$
>
> *According to Magma experiments, there exists $y_1=[1,0,0,0,0,0]∈F_3^6$ such that $\mathrm{dim}V(y_1,D)=4$. Then, it follows from Lemma 4 that $C(D)$ is not minimal.*

## 4 Concluding Remarks

In this paper, we use the approach used in [14] to study the minimality of linear codes constructed from sunflowers in all cases. In [23], the authors proved that if the number *s* of the elements in a sunflower satisfying $s≥p+1$, then the corresponding linear code over $F_p$ is minimal, where *p* is a prime number. Our results in this paper generalize [23] (Theorem 10). We discuss the minimality of linear codes constructed from sunflowers for all *s*. We obtain the following three results: (1) when $s≥q+1$, for any sunflower, the corresponding linear code is minimal; (2) when $2≤s≤3≤q$, for any sunflower, the corresponding linear code is not minimal; (3) when $3<s≤q$, for some sunflowers, the corresponding linear codes are minimal, whereas for some other sunflowers, the corresponding linear codes are not minimal.

## Author Contributions

Writing—original draft preparation, X.W.; writing—review and editing, W.L. All authors have read and agreed to the published version of the manuscript.

## Data Availability Statement

No new data were created or analyzed in this study. Data sharing is not applicable to this article.

## Conflicts of Interest

The authors declare no conflict of interest.

## Footnotes

- **Disclaimer/Publisher’s Note:** The statements, opinions and data contained in all publications are solely those of the individual author(s) and contributor(s) and not of MDPI and/or the editor(s). MDPI and/or the editor(s) disclaim responsibility for any injury to people or property resulting from any ideas, methods, instructions or products referred to in the content.

## References

- [1] Carlet C., Ding C., Yuan J. Linear codes from highly nonlinear functions and their secret sharing schemes. IEEE Trans. Inf. Theory 2005 51 2089–2102 DOI 10.1109/TIT.2005.847722
- [2] Chabanne H., Cohen G., Patey A. Towards secure two-party computation from the wire-tap channel. Proceedings of the ICISC 2013 Washington, DC, USA 16–18 September 2013 Lecture Notes in Computer Science Lee H.-S., Han D.-G. Springer Berlin/Heidelberg, Germany 2014 Volume 8565 34–46
- [3] Ding C., Yuan J. Covering and secret sharing with linear codes. Discrete Mathematics and Theoretical Computer Science Lecture Notes in Computer Science Springer Berlin/Heidelberg, Germany 2003 Volume 2731 11–25
- [4] Massey J.L. Minimal codewords and secret sharing. Proceedings of the 6th Joint Swedish-Russian Workshop on Information Theory Mölle, Sweden 22–27 August 1993 246–249
- [5] Yuan J., Ding C. Secret sharing schemes from three classes of linear codes. IEEE Trans. Inf. Theory 2006 52 206–212 DOI 10.1109/TIT.2005.860412
- [6] Ashikhmin A., Barg A., Cohen G., Huguet L. Variations on minimal codewords in linear codes. Applied Algebra, Algebraic Algorithms and Error-Correcting Codes, (AAECC-11) Lecture Notes in Computer Science Cohen G., Giusti M., Mora T. Springer Berlin/Heidelberg, Germany 1995 Volume 948 96–105
- [7] Cohen G.D., Mesnager S., Patey A. On minimal and quasi-minimal linear codes. Proceedings of IMACC Lecture Notes in Computer Science Stam M. Springer Berlin/Heidelberg, Germany 2003 Volume 8308 85–98
- [8] Ashikhmin A., Barg A. Minimal vectors in linear codes. IEEE Trans. Inf. Theory 1998 44 2010–2017 DOI 10.1109/18.705584
- [9] Ding C., Fan C., Zhou Z. The dimension and minimum distance of two classes of primitive BCH codes. Finite Fields Appl. 2017 45 237–263 DOI 10.1016/j.ffa.2016.12.009
- [10] Zhou Z., Ding C. Seven Classes of Three-Weight Cyclic Codes. IEEE Trans. Commun. 2013 61 4120–4126 DOI 10.1109/TCOMM.2013.072213.130107
- [11] Ding C., Heng Z., Zhou Z. Minimal binary linear codes. IEEE Trans. Inf. Theory 2018 64 6536–6545 DOI 10.1109/TIT.2018.2819196
- [12] Heng Z., Ding C., Zhou Z. Minimal linear codes over finite fields. Finite Fields Appl. 2018 54 176–196 DOI 10.1016/j.ffa.2018.08.010
- [13] Alfarano G.N., Borello M., Neri A. A geometric characterization of minimal codes and their asymptotic performance. Adv. Math. Commun. 2022 16 115–133 DOI 10.3934/amc.2020104
- [14] Lu W., Wu X. The parameters of minimal linear codes. Finite Fields Appl. 2021 71 176–196 DOI 10.1016/j.ffa.2020.101799
- [15] Tang C., Qiu Y., Liao Q., Zhou Z. Full Characterization of Minimal Linear Codes as Cutting Blocking Sets. IEEE Trans. Inf. Theory 2021 67 3690–3700 DOI 10.1109/TIT.2021.3070377
- [16] Alfarano G.N., Borello M., Neri A., Ravagnani A. Three Combinatorial Perspectives on Minimal Codes. Siam J. Discret. Math. 2022 36 461–489 DOI 10.1137/21M1391493
- [17] Bartoli D., Bonini M. Minimal linear codes in odd characteristic. IEEE Trans. Inf. Theory 2019 65 4152–4155 DOI 10.1109/TIT.2019.2891992
- [18] Bartoli D., Bonini M., Gunes B. An inductive construction of minimal codes. Cryptogr. Commun. 2021 13 439–449 DOI 10.1007/s12095-021-00474-2
- [19] Bartoli D., Cossidente A., Marino G., Pavese F. On cutting blocking sets and their codes. Forum Math. 2022 34 347–368 DOI 10.1515/forum-2020-0338
- [20] Bonini M., Borello M. Minimal linear codes arising from blocking sets. J. Algebr. Comb. 2021 53 327–341 DOI 10.1007/s10801-019-00930-6
- [21] Héger T., Nagy Z.L. Short minimal codes and covering codes via strong blocking sets in projective spaces. IEEE Trans. Inf. Theory 2022 68 881–890 DOI 10.1109/TIT.2021.3123730
- [22] Gorla E., Ravagnani A. Equidistant subspace codes. Linear Algebra Its Appl. 2016 490 48–65 DOI 10.1016/j.laa.2015.10.029
- [23] Li X., Yue Q., Tang D. A family of linear codes from constant dimension subspace codes. Des. Codes Cryptogr. 2022 90 1–15 DOI 10.1007/s10623-021-00960-x
- [24] Lu W., Wu X., Cao X., Luo G., Qin X. Minimal linear codes constructed from partial spreads. arXiv 2023 2305.05320 DOI 10.3390/e25121669 PMCID PMC10742731 PMID 38136549
